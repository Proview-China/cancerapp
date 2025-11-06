// 不使用 require('electron')，直接使用 process.electronBinding
const path = require('node:path')

// 获取 Electron API
let app, BrowserWindow, ipcMain;

if (process.type === 'browser') {
  // 直接从内部获取
  const electron = process._linkedBinding ? process._linkedBinding('electron_common_app') : null;

  // 如果上面失败了，尝试其他方法
  if (!electron || !electron.app) {
    // 使用 require，但需要在 Electron 上下文中
    const electronPath = require.resolve('electron');
    delete require.cache[electronPath];

    // 直接访问内部模块
    app = require('electron/lib/browser/api/app').default;
    BrowserWindow = require('electron/lib/browser/api/browser-window').default;
    ipcMain = require('electron/lib/browser/api/ipc-main').default;
  }
}

// 如果还是失败，尝试最后的方法
if (!app) {
  console.log('Trying alternative method...');
  try {
    const mainApi = require('electron/lib/browser/api/app');
    console.log('mainApi:', mainApi);
  } catch (e) {
    console.error('Failed:', e.message);
  }
}

console.log('app:', app);
console.log('BrowserWindow:', BrowserWindow);

if (app && BrowserWindow) {
  const isDev = process.env.NODE_ENV !== 'production';

  function createWindow() {
    const win = new BrowserWindow({
      width: 1280,
      height: 800,
      backgroundColor: '#E8ECF5',
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 18, y: 18 },
      title: 'CancerApp',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
      },
    });

    if (isDev) {
      win.loadURL('http://localhost:5173');
      win.webContents.openDevTools({ mode: 'detach' });
    } else {
      win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
  }

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  if (ipcMain) {
    ipcMain.handle('window:minimize', () => {
      BrowserWindow.getFocusedWindow()?.minimize();
    });

    ipcMain.handle('window:toggle-maximize', () => {
      const window = BrowserWindow.getFocusedWindow();
      if (!window) return;
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    });

    ipcMain.handle('window:close', () => {
      BrowserWindow.getFocusedWindow()?.close();
    });
  }

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
} else {
  console.error('Failed to load Electron APIs!');
  console.log('process.type:', process.type);
  console.log('Available in require.cache:', Object.keys(require.cache).filter(k => k.includes('electron')));
}