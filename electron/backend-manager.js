const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { BACKEND_PORT } = require("./config");
const { ensureDatabaseDir } = require("./database-manager");
const {
  getBackendDir,
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

function startBackend() {
  if (backendProcess) {
    return backendProcess;
  }

  const backendDir = getBackendDir();
  const backendEntry = path.join(backendDir, "index.js");
  const { command, args, extraEnv } = getNodeSpawn(backendEntry);

  backendProcess = spawn(command, args, {
    cwd: backendDir,
    env: {
      ...buildBackendEnv(),
      ...extraEnv,
    },
    stdio: "inherit",
  });

  backendProcess.on("error", (error) => {
    console.error("Failed to start backend:", error);
    backendProcess = null;
  });

  backendProcess.on("exit", (code, signal) => {
    console.log(`Backend exited (code=${code}, signal=${signal})`);
    backendProcess = null;
  });

  return backendProcess;
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
  isBackendRunning,
  buildBackendEnv,
  BACKEND_PORT,
};
