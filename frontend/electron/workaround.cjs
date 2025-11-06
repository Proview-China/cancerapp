// 使用 Electron 内置对象而不是 require
const { app, BrowserWindow } = process.type === 'browser'
  ? require('electron')
  : require('electron').remote;

console.log('Starting app...');
console.log('Process type:', process.type);

// 如果 app 还是 undefined，尝试从全局获取
if (!app && typeof global !== 'undefined' && global.app) {
  const { app: globalApp, BrowserWindow: globalBW } = global;
  app = globalApp;
  BrowserWindow = globalBW;
}

// 最后的尝试 - 直接从 process.electronBinding 获取
if (!app && process.electronBinding) {
  try {
    console.log('Trying electronBinding...');
    const electron = process.electronBinding('electron');
    console.log('electronBinding result:', electron);
  } catch (e) {
    console.log('electronBinding failed:', e.message);
  }
}

// 创建简单的窗口
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  win.loadURL('http://localhost:5173').catch(err => {
    win.loadURL(`data:text/html,<h1>Failed to load localhost:5173</h1><p>${err}</p>`);
  });
}

if (app) {
  app.whenReady().then(createWindow);
} else {
  console.error('Could not access Electron app object');
  console.log('Available globals:', Object.keys(global || {}));

  // 尝试创建窗口即使没有 app
  if (typeof BrowserWindow !== 'undefined') {
    createWindow();
  }
}