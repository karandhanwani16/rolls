/// <reference types="vite/client" />

interface ElectronAPI {
  getAppVersion: () => string;
  getApiUrl: () => string;
}

interface Window {
  electronAPI?: ElectronAPI;
}
