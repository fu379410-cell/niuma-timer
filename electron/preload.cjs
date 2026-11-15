const { contextBridge, ipcRenderer } = require('electron');

// Expose named application operations, never raw IPC or Node APIs.
contextBridge.exposeInMainWorld(
  'niumaDesktop',
  Object.freeze({
    openMini: () => ipcRenderer.invoke('niuma:open-mini'),
    setAlwaysOnTop: (enabled) => ipcRenderer.invoke('niuma:set-always-on-top', enabled),
    getState: () => ipcRenderer.invoke('niuma:get-state'),
    setTheme: (preference) => ipcRenderer.invoke('niuma:set-theme', preference),
    onThemeChanged: (callback) => {
      if (typeof callback !== 'function') throw new TypeError('Theme listener must be a function.');
      const listener = (_event, payload) => {
        if (
          !['light', 'dark', 'system'].includes(payload?.preference) ||
          !['light', 'dark'].includes(payload?.resolved)
        )
          return;
        callback({ preference: payload.preference, resolved: payload.resolved });
      };
      ipcRenderer.on('niuma:theme-changed', listener);
      return () => ipcRenderer.removeListener('niuma:theme-changed', listener);
    },
  })
);
