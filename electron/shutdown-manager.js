const { app, BrowserWindow } = require("electron");
const { stopBackend } = require("./backend-manager");
const { closeDatabase } = require("./database-manager");
const { stopUsbWatch } = require("./usb-manager");

const SHUTDOWN_TIMEOUT_MS = 8000;

let shutdownPromise = null;
let shutdownFinished = false;

async function runShutdown(reason) {
  console.log(`Graceful shutdown (${reason})`);
  stopUsbWatch();
  await stopBackend({ timeoutMs: SHUTDOWN_TIMEOUT_MS });
  closeDatabase();

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.destroy();
    }
  }
}

function shutdownApp(reason = "requested") {
  if (!shutdownPromise) {
    shutdownPromise = runShutdown(reason)
      .catch((error) => {
        console.error("Graceful shutdown failed:", error);
      })
      .finally(() => {
        shutdownFinished = true;
        app.exit(0);
      });
  }
  return shutdownPromise;
}

function registerShutdownHandlers() {
  app.on("before-quit", (event) => {
    if (shutdownFinished) {
      return;
    }

    event.preventDefault();
    shutdownApp("before-quit");
  });
}

module.exports = {
  SHUTDOWN_TIMEOUT_MS,
  registerShutdownHandlers,
  shutdownApp,
};
