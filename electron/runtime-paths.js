const { app } = require("electron");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");

function isPackaged() {
  return Boolean(app && app.isPackaged);
}

function backendLooksValid(dir) {
  return fs.existsSync(path.join(dir, "utils", "usbBackup.js")) && fs.existsSync(path.join(dir, "index.js"));
}

function getBackendDir() {
  const candidates = [];
  if (isPackaged()) {
    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, "backend"));
    }
    if (process.execPath) {
      candidates.push(path.join(path.dirname(process.execPath), "resources", "backend"));
    }
  }
  candidates.push(path.join(REPO_ROOT, "be"));

  const found = candidates.find(backendLooksValid);
  if (found) {
    return found;
  }

  throw new Error(
    [
      "TATex backend was not packaged next to TATex.exe.",
      "Copy the entire folder from out\\T. A. TEX-win32-x64\\ into the USB app\\ directory",
      "(including resources\\backend\\, not only TATex.exe).",
      `Tried:\n${candidates.join("\n")}`,
    ].join(" ")
  );
}

function getFrontendIndexHtml() {
  return path.join(REPO_ROOT, "fe", "dist", "index.html");
}

function getUsbRoot() {
  if (process.env.USB_ROOT) {
    return process.env.USB_ROOT;
  }
  if (isPackaged()) {
    return path.join(app.getPath("userData"), "usb-root");
  }
  return path.join(REPO_ROOT, "usb-dev");
}

function getDatabasePath() {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }
  return path.join(getUsbRoot(), "data", "database.sqlite");
}

function getNodeSpawn(scriptPath, extraArgs = []) {
  if (isPackaged()) {
    return {
      command: process.execPath,
      args: [scriptPath, ...extraArgs],
      extraEnv: { ELECTRON_RUN_AS_NODE: "1" },
    };
  }

  return {
    command: process.env.npm_node_execpath || "node",
    args: [scriptPath, ...extraArgs],
    extraEnv: {},
  };
}

module.exports = {
  REPO_ROOT,
  getBackendDir,
  getDatabasePath,
  getFrontendIndexHtml,
  getNodeSpawn,
  getUsbRoot,
  isPackaged,
};
