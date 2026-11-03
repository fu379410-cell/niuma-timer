const { contextBridge, ipcRenderer } = require('electron');

// Expose only the three application operations, never raw IPC or Node APIs.
contextBridge.exposeInMainWorld(
  'niumaDesktop',
  Object.freeze({
    openMini: () => ipcRenderer.invoke('niuma:open-mini'),
    setAlwaysOnTop: (enabled) => ipcRenderer.invoke('niuma:set-always-on-top', enabled),
    getState: () => ipcRenderer.invoke('niuma:get-state'),
  })
);
