// 极简的 Electron 测试
console.log('Starting Electron test...');
console.log('Process versions:', process.versions);

const electron = require('electron');
console.log('Electron loaded:', typeof electron);

// 只有在 Electron 主进程中才能访问 app
if (electron.app) {
  const { app, BrowserWindow } = electron;

  app.whenReady().then(() => {
    console.log('App ready!');
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    win.loadURL('data:text/html,<h1>Electron Works!</h1>');
  });
} else {
  console.log('ERROR: Not running in Electron context!');
  console.log('electron object:', electron);
}