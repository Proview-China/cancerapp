const { app, BrowserWindow } = require('electron')

console.log('Type of app:', typeof app)
console.log('process.type:', process.type)

if (!app) {
  console.error('CRITICAL: app is undefined!')
  console.log('require("electron"):', require('electron'))
  process.exit(1)
}

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600
  })

  win.loadURL('http://localhost:5173')
}

app.whenReady().then(() => {
  console.log('App is ready!')
  createWindow()
})