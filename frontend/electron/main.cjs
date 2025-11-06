const path = require('node:path')
const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron')
const fs = require('node:fs/promises')

const isDev = process.env.NODE_ENV !== 'production'

app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-gpu-sandbox')
app.commandLine.appendSwitch('disable-dev-shm-usage')

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#00000000',
    frame: false,
    autoHideMenuBar: true,
    transparent: true,
    roundedCorners: true,
    resizable: true,
    fullscreenable: true,
    title: 'CancerApp',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

ipcMain.handle('window:minimize', () => {
  BrowserWindow.getFocusedWindow()?.minimize()
})

ipcMain.handle('window:toggle-maximize', () => {
  const window = BrowserWindow.getFocusedWindow()
  if (!window) {
    return
  }
  if (window.isFullScreen()) {
    window.setFullScreen(false)
    return
  }
  if (window.isMaximized()) {
    window.unmaximize()
  } else {
    window.maximize()
  }
})

ipcMain.handle('window:close', () => {
  BrowserWindow.getFocusedWindow()?.close()
})

ipcMain.handle('samples:open-dialog', async () => {
  const window = BrowserWindow.getFocusedWindow()
  const result = await dialog.showOpenDialog(window ?? undefined, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Images',
        extensions: ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif', 'gif', 'dcm'],
      },
    ],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return []
  }

  const entries = await Promise.all(
    result.filePaths.map(async (filePath) => {
      const data = await fs.readFile(filePath)
      const extension = filePath.split('.').pop()?.toLowerCase() ?? ''
      const mimeMap = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        bmp: 'image/bmp',
        gif: 'image/gif',
        tif: 'image/tiff',
        tiff: 'image/tiff',
        dcm: 'application/dicom',
      }
      const mimeType = mimeMap[extension] ?? 'application/octet-stream'
      return {
        name: filePath.split(/[\\/]/).pop() ?? 'sample',
        mimeType,
        data: data.toString('base64'),
      }
    }),
  )

  return entries
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
