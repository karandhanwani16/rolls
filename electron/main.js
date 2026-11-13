const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const { startBackend, waitForBackend } = require("./backend-manager");
const { ensureDatabase } = require("./database-manager");
const { registerShutdownHandlers, shutdownApp } = require("./shutdown-manager");
const { startUsbWatch } = require("./usb-manager");
const { FRONTEND_DEV_URL, SHUTDOWN_PORT } = require("./config");
const { getFrontendIndexHtml, getUsbRoot, isPackaged } = require("./runtime-paths");

let mainWindow = null;

function isDev() {
  return !isPackaged();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev()) {
    mainWindow.loadURL(FRONTEND_DEV_URL);
  } else {
    mainWindow.loadFile(getFrontendIndexHtml(), { hash: "/login" });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

registerShutdownHandlers();

app.whenReady().then(async () => {
  try {
    await ensureDatabase();
  } catch (error) {
    dialog.showErrorBox("T. A. TEX failed to start", error.stack || String(error));
    app.quit();
    return;
  }
  startBackend();
  try {
    await waitForBackend(45000);
  } catch (error) {
    dialog.showErrorBox("T. A. TEX backend failed to start", error.stack || String(error));
    app.quit();
    return;
  }
  createWindow();
  startUsbWatch({
    usbRoot: getUsbRoot(),
    port: SHUTDOWN_PORT,
    onRemoved: (reason) => shutdownApp(reason || "usb-removed"),
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
