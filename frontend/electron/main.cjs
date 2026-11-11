const path = require('node:path')
const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron')
const fs = require('node:fs/promises')
const { pathToFileURL } = require('node:url')
const { listenOwned, startOwnedChild } = require('./startup.cjs')
const { spawn } = require('node:child_process')

// 使用 app.isPackaged 判断环境，避免依赖 NODE_ENV 导致打包后仍走开发路径
const isDev = !app.isPackaged
let devChild
let quitting = false

async function startBackend() {
  if (isDev) {
    devChild = await startOwnedChild(spawn, process.env.npm_node_execpath || 'node', path.join(__dirname, 'dev-server.cjs'), () => {
      if (!quitting) {
        for (const window of BrowserWindow.getAllWindows()) window.destroy()
        dialog.showErrorBox('开发服务已停止', '本机开发服务进程已退出。')
        app.quit()
      }
    })
    return
  }
  const origin = 'http://127.0.0.1:4000'
  const pageRoot = path.join(app.getAppPath(), 'dist')
  await fs.access(path.join(pageRoot, 'index.html'))
  process.env.AUTH_ALLOWED_ORIGINS = origin
  process.env.UPLOADS_ROOT = process.env.UPLOADS_ROOT || path.join(path.dirname(app.getPath('exe')), 'uploads')
  process.env.NODE_ENV = 'production'
  const { app: backend } = await import(pathToFileURL(path.join(process.resourcesPath, 'backend', 'dist', 'app.js')).href)
  const express = (await import(pathToFileURL(path.join(process.resourcesPath, 'backend', 'node_modules', 'express', 'index.js')).href)).default
  backend.use(express.static(pageRoot, { index: 'index.html', fallthrough: false }))
  return listenOwned(backend, 4000, '127.0.0.1', error => {
    console.error('本机服务错误')
    dialog.showErrorBox('本机服务错误', '本机服务已停止。')
    app.quit()
  })
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
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    try {
      if (new URL(url).origin !== 'http://127.0.0.1:4000') event.preventDefault()
    } catch { event.preventDefault() }
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

  win.loadURL('http://127.0.0.1:4000').catch(() => {
      dialog.showErrorBox('页面加载失败', '无法加载本机页面。')
      app.quit()
    })
  if (isDev) win.webContents.openDevTools({ mode: 'detach' })
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  try {
    await startBackend()
  } catch (error) {
    const known = ['端口 4000 已被占用', '开发服务启动超时', '无法启动开发服务进程', '开发服务进程提前退出', '开发服务启动失败，请检查依赖与运行环境']
    const message = error?.code === 'EADDRINUSE' ? known[0] : known.includes(error?.message) ? error.message : '请检查本机资源和运行环境'
    console.error('启动失败:', message)
    dialog.showErrorBox('无法启动', `本机服务或页面启动失败：${message}`)
    app.quit()
    return
  }
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  quitting = true
  if (devChild?.connected) devChild.disconnect()
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
