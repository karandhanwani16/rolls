const { contextBridge } = require("electron");

// Sandboxed preload can only require("electron"). Keep this file self-contained.
const APP_VERSION = "1.0.0";
const API_URL = "http://127.0.0.1:47821";

contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: () => APP_VERSION,
  getApiUrl: () => API_URL,
});
