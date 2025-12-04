const path = require('node:path')
const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron')
const fs = require('node:fs/promises')

// 使用 app.isPackaged 判断环境，避免依赖 NODE_ENV 导致打包后仍走开发路径
const isDev = !app.isPackaged

async function startBackend() {
  if (isDev) return
  try {
    const backendEntry = path.join(process.resourcesPath, 'backend', 'server.js')
    // 在打包环境中，将上传目录固定到 exe 所在目录下的 uploads，便于绿色迁移
    const appDir = path.dirname(app.getPath('exe'))
    process.env.UPLOADS_ROOT = process.env.UPLOADS_ROOT || path.join(appDir, 'uploads')
    // 数据库连接串保持与开发环境一致，必要时可在启动前通过环境变量覆盖
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || 'postgres://postgres:aass0371@localhost:5432/cancerapp'
    process.env.NODE_ENV = 'production'

    // 动态导入后端 server（ESM）
    const backendUrl = new URL(`file://${backendEntry.replace(/\\/g, '/')}`)
    await import(backendUrl.href)
    // server.ts 内部会自行监听端口，无需在此持有引用
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('启动后端失败：', error)
  }
}

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

  // 允许 Ctrl/Cmd +/-/0 控制缩放，保持当前窗口内有效
  let zoomFactor = 1
  win.webContents.setVisualZoomLevelLimits(1, 3)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const useAccel = input.control || input.meta
    if (!useAccel) return

    if (input.key === '0') {
      zoomFactor = 1
      win.webContents.setZoomFactor(zoomFactor)
      event.preventDefault()
    }
    if (input.key === '-' || input.key === '_') {
      zoomFactor = Math.max(0.5, zoomFactor - 0.1)
      win.webContents.setZoomFactor(zoomFactor)
      event.preventDefault()
    }
    if (input.key === '=' || input.key === '+') {
      zoomFactor = Math.min(3, zoomFactor + 0.1)
      win.webContents.setZoomFactor(zoomFactor)
      event.preventDefault()
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  await startBackend()
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
