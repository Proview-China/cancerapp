const path = require('node:path')
const { app, BrowserWindow } = require('electron')

console.log('Electron app starting...')
console.log('App path:', app.getAppPath())

function createWindow() {
  console.log('Creating window...')

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  win.loadURL('http://localhost:5173').catch(err => {
    console.error('Failed to load URL:', err)
    // 如果加载失败，显示错误信息
    win.loadURL(`data:text/html,<h1>Failed to connect to Vite server at localhost:5173</h1><p>${err}</p>`)
  })

  // 打开开发者工具
  win.webContents.openDevTools()
}

app.whenReady().then(() => {
  console.log('App ready!')
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// 捕获未处理的错误
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})