const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const {
  getBackendDir,
  getDatabasePath,
  getNodeSpawn,
  getUsbRoot,
  isPackaged,
} = require("./runtime-paths");

function loadUsbModules() {
  const backendDir = getBackendDir();
  return {
    usbBackup: require(path.join(backendDir, "utils", "usbBackup")),
    usbCrypto: require(path.join(backendDir, "utils", "usbCrypto")),
    usbDevice: require(path.join(backendDir, "utils", "usbDevice")),
  };
}

function getUsbRootResolved() {
  return getUsbRoot();
}

function getDatabasePathResolved() {
  return getDatabasePath();
}

function ensureDatabaseDir() {
  const { usbDevice } = loadUsbModules();
  const paths = usbDevice.ensureUsbLayout(getUsbRootResolved());
  fs.mkdirSync(path.dirname(getDatabasePathResolved()), { recursive: true });
  return paths.sqlite;
}

function preserveExistingSqlite(paths) {
  if (!fs.existsSync(paths.sqlite)) {
    return;
  }
  const safety = path.join(paths.emergency, "pre-phase10.sqlite");
  if (!fs.existsSync(safety)) {
    fs.copyFileSync(paths.sqlite, safety);
  }
}

function openWorkingDatabase(paths, key) {
  if (fs.existsSync(paths.encrypted)) {
    const { usbCrypto } = loadUsbModules();
    usbCrypto.decryptFile(paths.encrypted, paths.sqlite, key);
    return;
  }
  preserveExistingSqlite(paths);
}

function applyMigrations() {
  const databasePath = path.resolve(getDatabasePathResolved());
  const usbRoot = getUsbRootResolved();
  const backendDir = getBackendDir();
  const migrateScript = path.join(backendDir, "scripts", "apply-migrations.js");
  const { command, args, extraEnv } = getNodeSpawn(migrateScript);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: backendDir,
      env: {
        ...process.env,
        ...extraEnv,
        USB_ROOT: usbRoot,
        DATABASE_PATH: databasePath,
        DATABASE_URL: `file:${databasePath}`,
      },
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`SQLite migrations failed (exit ${code})`));
      }
    });
  });
}

async function ensureDatabase() {
  const { usbBackup, usbDevice } = loadUsbModules();
  const usbRoot = getUsbRootResolved();
  const allowInit = !isPackaged() || process.env.TATEX_ALLOW_DEVICE_INIT === "1";
  const { paths, key } = usbDevice.ensureUsbDevice(usbRoot, { allowInit });

  openWorkingDatabase(paths, key);
  await applyMigrations();
  usbBackup.createBackup(usbRoot, "daily");
  usbBackup.createBackup(usbRoot, "weekly");
  usbDevice.appendUsbLog(usbRoot, "database ready");

  return {
    usbRoot,
    databasePath: paths.sqlite,
  };
}

function closeDatabase() {
  const usbRoot = getUsbRootResolved();
  if (!fs.existsSync(usbRoot)) {
    return;
  }

  const { usbBackup, usbCrypto, usbDevice } = loadUsbModules();
  let auth;
  try {
    auth = usbDevice.validateUsbRoot(usbRoot);
  } catch (error) {
    console.error("Skipping USB seal; device is not authorized:", error.message);
    return;
  }

  const { paths, key } = auth;
  if (!fs.existsSync(paths.sqlite)) {
    return;
  }

  usbBackup.createBackup(usbRoot, "emergency");
  usbCrypto.encryptFile(paths.sqlite, paths.encrypted, key);
  try {
    fs.unlinkSync(paths.sqlite);
    for (const extra of ["database.sqlite-journal", "database.sqlite-wal", "database.sqlite-shm"]) {
      const leftover = path.join(paths.data, extra);
      if (fs.existsSync(leftover)) {
        fs.unlinkSync(leftover);
      }
    }
  } catch (error) {
    console.error("Could not remove plaintext sqlite after encrypt:", error.message);
  }
  usbDevice.appendUsbLog(usbRoot, "database sealed");
}

function restoreBackup(kind, filename, options) {
  const { usbBackup, usbDevice } = loadUsbModules();
  const usbRoot = getUsbRootResolved();
  const { key } = usbDevice.validateUsbRoot(usbRoot);
  const result = usbBackup.restoreBackup(usbRoot, kind, filename, options);
  usbBackup.decryptRestoredDatabase(usbRoot, key);
  return result;
}

module.exports = {
  applyMigrations,
  closeDatabase,
  ensureDatabase,
  ensureDatabaseDir,
  getDatabasePath: getDatabasePathResolved,
  getUsbRoot: getUsbRootResolved,
  restoreBackup,
};
