const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { KEY_BYTES } = require("./usbCrypto");

const PRODUCT = "TATex";
const LAYOUT_DIRS = [
  "app",
  "data",
  "backups/daily",
  "backups/weekly",
  "backups/emergency",
  "config",
  "logs",
  "security",
];

function usbPaths(usbRoot) {
  const root = path.resolve(usbRoot);
  return {
    root,
    app: path.join(root, "app"),
    data: path.join(root, "data"),
    backups: path.join(root, "backups"),
    daily: path.join(root, "backups", "daily"),
    weekly: path.join(root, "backups", "weekly"),
    emergency: path.join(root, "backups", "emergency"),
    config: path.join(root, "config"),
    logs: path.join(root, "logs"),
    security: path.join(root, "security"),
    deviceJson: path.join(root, "config", "device.json"),
    deviceKey: path.join(root, "security", "device.key"),
    sqlite: path.join(root, "data", "database.sqlite"),
    encrypted: path.join(root, "data", "database.sqlite.enc"),
    shutdownRequest: path.join(root, "config", "shutdown.request"),
  };
}

function ensureUsbLayout(usbRoot) {
  const paths = usbPaths(usbRoot);
  for (const relative of LAYOUT_DIRS) {
    fs.mkdirSync(path.join(paths.root, relative), { recursive: true });
  }
  return paths;
}

function fingerprintKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function readDeviceKey(keyPath) {
  const hex = fs.readFileSync(keyPath, "utf8").trim();
  const key = Buffer.from(hex, "hex");
  if (key.length !== KEY_BYTES) {
    throw new Error("USB device.key is not a 32-byte key");
  }
  return key;
}

function writeDeviceKey(keyPath, key) {
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  fs.writeFileSync(keyPath, key.toString("hex"), { encoding: "utf8", mode: 0o600 });
}

function readDeviceJson(jsonPath) {
  return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
}

function validateUsbRoot(usbRoot) {
  const paths = usbPaths(usbRoot);
  if (!fs.existsSync(paths.deviceJson) || !fs.existsSync(paths.deviceKey)) {
    const error = new Error("USB is not authorized: missing device.json or device.key");
    error.code = "USB_AUTH_MISSING";
    throw error;
  }

  const device = readDeviceJson(paths.deviceJson);
  if (device.product !== PRODUCT) {
    throw new Error("USB is not authorized: product mismatch");
  }

  const key = readDeviceKey(paths.deviceKey);
  const fingerprint = fingerprintKey(key);
  if (device.keyFingerprint !== fingerprint) {
    throw new Error("USB is not authorized: device key does not match device.json");
  }

  return { paths, device, key };
}

function initializeUsbDevice(usbRoot) {
  const paths = ensureUsbLayout(usbRoot);
  const key = crypto.randomBytes(KEY_BYTES);
  const device = {
    product: PRODUCT,
    deviceId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    keyFingerprint: fingerprintKey(key),
  };
  fs.writeFileSync(paths.deviceJson, `${JSON.stringify(device, null, 2)}\n`);
  writeDeviceKey(paths.deviceKey, key);
  return { paths, device, key };
}

function ensureUsbDevice(usbRoot, { allowInit = false } = {}) {
  const paths = ensureUsbLayout(usbRoot);
  const hasJson = fs.existsSync(paths.deviceJson);
  const hasKey = fs.existsSync(paths.deviceKey);

  if (hasJson && hasKey) {
    return validateUsbRoot(usbRoot);
  }

  if (hasJson !== hasKey) {
    throw new Error("USB is not authorized: incomplete device identity (copied folder without key or json)");
  }

  if (!allowInit) {
    const error = new Error("USB is not authorized: unknown device (not initialized)");
    error.code = "USB_AUTH_UNKNOWN";
    throw error;
  }

  return initializeUsbDevice(usbRoot);
}

function appendUsbLog(usbRoot, message) {
  try {
    const paths = usbPaths(usbRoot);
    fs.mkdirSync(paths.logs, { recursive: true });
    fs.appendFileSync(
      path.join(paths.logs, "tatex.log"),
      `${new Date().toISOString()} ${message}\n`
    );
  } catch {
    // USB may already be gone.
  }
}

module.exports = {
  PRODUCT,
  appendUsbLog,
  ensureUsbDevice,
  ensureUsbLayout,
  fingerprintKey,
  initializeUsbDevice,
  readDeviceKey,
  usbPaths,
  validateUsbRoot,
};
