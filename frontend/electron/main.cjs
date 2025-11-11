const path = require('node:path')
const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron')
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

// 仅允许打开 uploads 与 demo_fake 下的文件
const fsSync = require('node:fs')
const allowRoots = [
  path.resolve(__dirname, '..', '..', 'uploads'),
  path.resolve(__dirname, '..', '..', 'demo_fake'),
]

const isWithin = (file, root) => {
  const rel = path.relative(root, file)
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel)
}

ipcMain.handle('system:open-path', async (_event, absPath) => {
  try {
    if (typeof absPath !== 'string' || absPath.trim() === '') {
      return { ok: false, error: '无效路径' }
    }
    const resolved = path.resolve(absPath)
    if (!fsSync.existsSync(resolved)) {
      return { ok: false, error: '文件不存在' }
    }
    const allowed = allowRoots.some((root) => isWithin(resolved, root))
    if (!allowed) {
      return { ok: false, error: '不允许打开的路径' }
    }
    const result = await shell.openPath(resolved)
    if (result) {
      return { ok: false, error: result }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
