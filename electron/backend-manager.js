const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { app } = require("electron");
const { BACKEND_PORT } = require("./config");
const { ensureDatabaseDir } = require("./database-manager");
const {
  getBackendDir,
  getBundledNodePath,
  getDatabasePath,
  getNodeSpawn,
  getUsbRoot,
  isPackaged,
} = require("./runtime-paths");

let backendProcess = null;
let stopPromise = null;

function parseEnvFile(filePath) {
  const parsed = {};
  if (!fs.existsSync(filePath)) {
    return parsed;
  }

  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function getOrCreateJwtSecret(fromFile) {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  if (fromFile.JWT_SECRET && fromFile.JWT_SECRET !== "your-very-secure-jwt-secret-key-here") {
    return fromFile.JWT_SECRET;
  }
  if (!isPackaged()) {
    return fromFile.JWT_SECRET;
  }

  const secretFile = path.join(app.getPath("userData"), "jwt-secret");
  if (fs.existsSync(secretFile)) {
    return fs.readFileSync(secretFile, "utf8").trim();
  }
  const secret = crypto.randomBytes(64).toString("hex");
  fs.mkdirSync(path.dirname(secretFile), { recursive: true });
  fs.writeFileSync(secretFile, secret, { encoding: "utf8", mode: 0o600 });
  return secret;
}

function getBackendLogPath() {
  try {
    const usbRoot = getUsbRoot();
    const logsDir = path.join(usbRoot, "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    return path.join(logsDir, "backend.log");
  } catch {
    const fallback = path.join(app.getPath("userData"), "backend.log");
    fs.mkdirSync(path.dirname(fallback), { recursive: true });
    return fallback;
  }
}

function buildBackendEnv() {
  const backendDir = getBackendDir();
  const fromFile = parseEnvFile(path.join(backendDir, ".env"));
  const usbRoot = getUsbRoot();
  const databasePath = getDatabasePath();

  ensureDatabaseDir();

  const env = {
    ...fromFile,
    ...process.env,
    PORT: String(BACKEND_PORT),
    USB_ROOT: usbRoot,
    DATABASE_PATH: databasePath,
    DATABASE_URL: `file:${path.resolve(databasePath)}`,
    JWT_SECRET: getOrCreateJwtSecret(fromFile),
  };

  if (isPackaged()) {
    env.NODE_ENV = env.NODE_ENV || "production";
    env.CORS_ORIGINS = env.CORS_ORIGINS || "http://localhost:8080";
  }

  return env;
}

function appendBackendLog(message) {
  try {
    fs.appendFileSync(getBackendLogPath(), `${message}\n`, "utf8");
  } catch {
    // ignore logging failures
  }
}

function startBackend() {
  if (backendProcess) {
    return backendProcess;
  }

  const backendDir = getBackendDir();
  const backendEntry = path.join(backendDir, "index.js");
  const { command, args, extraEnv } = getNodeSpawn(backendEntry);
  const logPath = getBackendLogPath();

  appendBackendLog(
    `[${new Date().toISOString()}] starting backend command=${command} args=${JSON.stringify(
      args
    )} bundledNode=${getBundledNodePath() || "(none)"}`
  );

  let logFd = "inherit";
  try {
    logFd = fs.openSync(logPath, "a");
  } catch {
    logFd = "inherit";
  }

  backendProcess = spawn(command, args, {
    cwd: backendDir,
    env: {
      ...buildBackendEnv(),
      ...extraEnv,
    },
    stdio: logFd === "inherit" ? "inherit" : ["ignore", logFd, logFd],
  });

  backendProcess.on("error", (error) => {
    console.error("Failed to start backend:", error);
    appendBackendLog(`[${new Date().toISOString()}] spawn error: ${error.stack || error}`);
    backendProcess = null;
  });

  backendProcess.on("exit", (code, signal) => {
    const line = `Backend exited (code=${code}, signal=${signal})`;
    console.log(line);
    appendBackendLog(`[${new Date().toISOString()}] ${line}`);
    backendProcess = null;
  });

  return backendProcess;
}

function probeHealth(timeoutMs = 1000) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host: "127.0.0.1",
        port: BACKEND_PORT,
        path: "/api/health",
        timeout: timeoutMs,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
  });
}

async function waitForBackend(timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!backendProcess) {
      throw new Error(
        `Backend process exited before becoming ready. See log: ${getBackendLogPath()}`
      );
    }
    if (await probeHealth(800)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(
    `Backend did not become ready on port ${BACKEND_PORT}. See log: ${getBackendLogPath()}`
  );
}

function isBackendRunning() {
  return Boolean(backendProcess);
}

function stopBackend(options = {}) {
  if (stopPromise) {
    return stopPromise;
  }

  const child = backendProcess;
  if (!child) {
    return Promise.resolve();
  }

  const timeoutMs = options.timeoutMs ?? 8000;

  stopPromise = new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(killTimer);
      if (backendProcess === child) {
        backendProcess = null;
      }
      stopPromise = null;
      resolve();
    };

    child.once("exit", finish);

    try {
      child.kill("SIGTERM");
    } catch {
      finish();
      return;
    }

    const killTimer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        finish();
      }
    }, timeoutMs);
  });

  return stopPromise;
}

module.exports = {
  startBackend,
  stopBackend,
  waitForBackend,
  isBackendRunning,
  buildBackendEnv,
  BACKEND_PORT,
};
