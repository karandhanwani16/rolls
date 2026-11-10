const { getDatabasePath, getUsbRoot } = require("./runtime-paths");

const BACKEND_PORT = Number(process.env.ELECTRON_BACKEND_PORT) || 47821;
const SHUTDOWN_PORT = Number(process.env.TATEX_SHUTDOWN_PORT) || 47820;
const FRONTEND_DEV_URL = process.env.ELECTRON_RENDERER_URL || "http://localhost:8080";

module.exports = {
  BACKEND_PORT,
  SHUTDOWN_PORT,
  FRONTEND_DEV_URL,
  get USB_ROOT() {
    return getUsbRoot();
  },
  get DATABASE_PATH() {
    return getDatabasePath();
  },
};
