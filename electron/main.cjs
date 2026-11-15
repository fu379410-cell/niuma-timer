const { app, BrowserWindow, ipcMain, Menu, shell, nativeTheme } = require('electron');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

app.setName('牛马计时器');

const indexFile = path.join(__dirname, '..', 'dist', 'index.html');
const development = !app.isPackaged && process.env.NIUMA_USE_DIST !== '1';
const devURL = 'http://localhost:5173/';
const fileURL = pathToFileURL(indexFile);
let mainWindow;
let miniWindow;
const themePreferences = new Set(['light', 'dark', 'system']);
let themePreference = 'system';
let themeInitialized = false;
let themeWriteQueue = Promise.resolve();

function themeSnapshot() {
  return {
    preference: themePreference,
    resolved: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
  };
}

function themePalette() {
  return nativeTheme.shouldUseDarkColors
    ? { tint: '#99131526', solid: '#131526', symbol: '#F4F3FA' }
    : { tint: '#B3F6F4EC', solid: '#F6F4EC', symbol: '#292B36' };
}

async function initializeTheme() {
  try {
    const value = JSON.parse(
      await fs.readFile(path.join(app.getPath('userData'), 'theme.json'), 'utf8')
    );
    if (themePreferences.has(value?.preference)) themePreference = value.preference;
  } catch (error) {
    if (error.code !== 'ENOENT')
      console.warn('Theme preference unavailable; following system appearance.');
  }
  nativeTheme.themeSource = themePreference;
  themeInitialized = true;
}

async function persistTheme(preference) {
  const directory = app.getPath('userData');
  const destination = path.join(directory, 'theme.json');
  const temporary = path.join(directory, `theme.json.${process.pid}.tmp`);
  await fs.mkdir(directory, { recursive: true });
  try {
    await fs.writeFile(temporary, `${JSON.stringify({ preference })}\n`, { mode: 0o600 });
    await fs.rename(temporary, destination);
  } finally {
    await fs.unlink(temporary).catch((error) => {
      if (error.code !== 'ENOENT') console.warn('Unable to remove temporary theme preference.');
    });
  }
}

function notifyTheme(window) {
  if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
    window.webContents.send('niuma:theme-changed', themeSnapshot());
  }
}

function applyThemeToWindows() {
  const options = glassWindowOptions();
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue;
    window.setBackgroundColor(options.backgroundColor);
    if (process.platform === 'win32') window.setTitleBarOverlay(options.titleBarOverlay);
    // macOS nativeTheme updates the native appearance of vibrancy and traffic lights.
    notifyTheme(window);
  }
}

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

function glassWindowOptions() {
  const palette = themePalette();
  if (process.platform === 'darwin') {
    return {
      transparent: true,
      // Electron uses #AARRGGBB: tinted native blur keeps both themes readable.
      backgroundColor: palette.tint,
      vibrancy: 'under-window',
      visualEffectState: 'active',
      titleBarStyle: 'hiddenInset',
      titleBarOverlay: true,
      trafficLightPosition: { x: 20, y: 18 },
    };
  }
  if (process.platform === 'win32') {
    const [major, , build] = os.release().split('.').map(Number);
    const supportsMaterial = major > 10 || (major === 10 && build >= 22621);
    return {
      // DWM supplies translucency for acrylic; avoid layered-window restrictions.
      transparent: false,
      backgroundColor: supportsMaterial ? palette.tint : palette.solid,
      backgroundMaterial: supportsMaterial ? 'acrylic' : 'none',
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: palette.solid,
        symbolColor: palette.symbol,
        height: 48,
      },
    };
  }
  return { backgroundColor: palette.solid };
}

async function createWindow(mini = false) {
  const window = new BrowserWindow({
    title: mini ? '牛马计时器 · 迷你模式' : '牛马计时器',
    icon: path.join(__dirname, '..', 'dist', 'app-icon.png'),
    width: mini ? 400 : 1340,
    height: mini ? 640 : 920,
    minWidth: mini ? 360 : 1000,
    minHeight: mini ? 560 : 740,
    show: false,
    ...glassWindowOptions(),
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
  window.webContents.on('did-finish-load', () => notifyTheme(window));
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
      themePreference,
      resolvedTheme: themeSnapshot().resolved,
    };
  });
  ipcMain.handle('niuma:set-theme', (event, preference) => {
    requireAppWindow(event);
    if (!themePreferences.has(preference))
      throw new TypeError('Expected light, dark or system theme.');
    // Serialize multiple windows' writes so disk and native appearance stay in order.
    const update = themeWriteQueue
      .catch(() => {})
      .then(async () => {
        await persistTheme(preference);
        themePreference = preference;
        nativeTheme.themeSource = preference;
        applyThemeToWindows();
        return themeSnapshot();
      });
    themeWriteQueue = update;
    return update;
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
    } else if (app.isReady() && themeInitialized) {
      void createWindow();
    }
  });
  app
    .whenReady()
    .then(async () => {
      if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
      await initializeTheme();
      nativeTheme.on('updated', applyThemeToWindows);
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
