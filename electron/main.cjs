const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

app.setName('牛马计时器');

const indexFile = path.join(__dirname, '..', 'dist', 'index.html');
const development = !app.isPackaged && process.env.NIUMA_USE_DIST !== '1';
const devURL = 'http://localhost:5173/';
const fileURL = pathToFileURL(indexFile);
let mainWindow;
let miniWindow;

function isAppDocument(value) {
  try {
    const url = new URL(value);
    if (development) {
      return (
        url.origin === new URL(devURL).origin &&
        (url.pathname === '/' || url.pathname === '/index.html')
      );
    }
    return (
      url.protocol === 'file:' &&
      url.hostname === fileURL.hostname &&
      url.pathname === fileURL.pathname
    );
  } catch {
    return false;
  }
}

function openHTTPS(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) {
      void shell.openExternal(url.href).catch(console.error);
    }
  } catch {
    // Ignore unsupported links; renderer content cannot choose an OS command.
  }
}

function protectWindow(window) {
  const { webContents } = window;
  const restrictNavigation = (event, legacyURL) => {
    const url = event.url || legacyURL;
    if (!isAppDocument(url)) {
      event.preventDefault();
      openHTTPS(url);
    }
  };
  webContents.on('will-navigate', restrictNavigation);
  webContents.on('will-redirect', restrictNavigation);
  webContents.on('will-attach-webview', (event) => event.preventDefault());
  webContents.setWindowOpenHandler(({ url }) => {
    openHTTPS(url);
    return { action: 'deny' };
  });
  webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false)
  );
  webContents.session.setPermissionCheckHandler(() => false);
}

async function createWindow(mini = false) {
  const window = new BrowserWindow({
    title: mini ? '牛马计时器 · 迷你模式' : '牛马计时器',
    icon: path.join(__dirname, '..', 'dist', 'app-icon.png'),
    width: mini ? 380 : 1320,
    height: mini ? 520 : 900,
    minWidth: mini ? 340 : 940,
    minHeight: mini ? 460 : 700,
    show: false,
    backgroundColor: '#f3f2ec',
    autoHideMenuBar: true,
    alwaysOnTop: mini,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
    },
  });
  protectWindow(window);
  window.once('ready-to-show', () => window.show());
  window.webContents.on('did-fail-load', (_event, code, description) => {
    if (code !== -3) console.error(`Unable to load 牛马计时器: ${description} (${code})`);
  });
  if (mini) {
    miniWindow = window;
    window.on('closed', () => {
      miniWindow = undefined;
    });
  } else {
    mainWindow = window;
    window.on('closed', () => {
      mainWindow = undefined;
    });
  }
  try {
    if (development) {
      const url = new URL(devURL);
      if (mini) url.searchParams.set('mini', '1');
      await window.loadURL(url.href);
    } else {
      await window.loadFile(indexFile, mini ? { query: { mini: '1' } } : {});
    }
  } catch (error) {
    console.error(error);
    if (!window.isDestroyed()) window.show();
  }
  return window;
}

function requireAppWindow(event) {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (
    !window ||
    !event.senderFrame ||
    event.senderFrame !== event.sender.mainFrame ||
    !isAppDocument(event.senderFrame.url)
  ) {
    throw new Error('Untrusted desktop IPC sender.');
  }
  return window;
}

function registerDesktopAPI() {
  ipcMain.handle('niuma:open-mini', async (event) => {
    requireAppWindow(event);
    if (miniWindow && !miniWindow.isDestroyed()) {
      if (miniWindow.isMinimized()) miniWindow.restore();
      miniWindow.show();
      miniWindow.focus();
    } else {
      await createWindow(true);
    }
    return { opened: true };
  });
  ipcMain.handle('niuma:set-always-on-top', (event, enabled) => {
    const window = requireAppWindow(event);
    if (typeof enabled !== 'boolean') throw new TypeError('Expected a boolean.');
    window.setAlwaysOnTop(enabled);
    return window.isAlwaysOnTop();
  });
  ipcMain.handle('niuma:get-state', (event) => {
    const window = requireAppWindow(event);
    return {
      alwaysOnTop: window.isAlwaysOnTop(),
      mini: window === miniWindow,
      platform: process.platform,
    };
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const window = mainWindow || miniWindow;
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    } else if (app.isReady()) {
      void createWindow();
    }
  });
  app
    .whenReady()
    .then(async () => {
      if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
      registerDesktopAPI();
      await createWindow();
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) void createWindow();
      });
    })
    .catch(console.error);
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
