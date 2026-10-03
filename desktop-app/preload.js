const { contextBridge, ipcRenderer } = require('electron');

// NEW: with contextIsolation + sandbox both on (correctly, for security),
// the renderer can't reach Node/Electron APIs directly. This exposes
// exactly two narrow, purpose-built methods - nothing generic like
// "run this IPC channel" - so the Settings page can offer a "connect to
// a remote/cloud server" option (see DEPLOY.md) without widening the
// app's attack surface. Presence of `window.smartshootsDesktop` is also
// how the frontend knows it's running inside the Electron app at all
// (vs. a plain browser or the Android/Capacitor build), to decide
// whether to show this option.
contextBridge.exposeInMainWorld('smartshootsDesktop', {
  getConnectionConfig: () => ipcRenderer.invoke('smartshoots:get-connection-config'),
  setConnectionConfig: (config) => ipcRenderer.invoke('smartshoots:set-connection-config', config),
  getLanAddress: () => ipcRenderer.invoke('smartshoots:get-lan-address'),
});
