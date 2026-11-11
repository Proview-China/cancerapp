// Resolve only after this process owns the listening socket; never probe an existing service.
function listenOwned(backend, port, host, onRuntimeError = error => { console.error('本机服务错误:', error) }) {
  return new Promise((resolve, reject) => {
    const server = backend.listen(port, host)
    const onError = error => reject(error)
    server.once('error', onError)
    server.once('listening', () => {
      server.removeListener('error', onError)
      server.on('error', onRuntimeError)
      resolve(server)
    })
  })
}
function startOwnedChild(spawn, executable, script, onExit, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [script], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: { ...process.env } })
    let ready = false
    let settled = false
    const timer = setTimeout(() => {
      if (!settled) { settled = true; child.kill(); reject(new Error('开发服务启动超时')) }
    }, timeoutMs)
    child.on('message', message => {
      if (settled || !message || typeof message !== 'object') return
      if (message.type === 'ready') {
        settled = true; ready = true; clearTimeout(timer); resolve(child)
      } else if (message.type === 'error') {
        settled = true; clearTimeout(timer); child.kill()
        reject(new Error(message.code === 'EADDRINUSE' ? '端口 4000 已被占用' : '开发服务启动失败，请检查依赖与运行环境'))
      }
    })
    child.once('error', () => {
      if (!settled) { settled = true; clearTimeout(timer); reject(new Error('无法启动开发服务进程')) }
    })
    child.once('exit', () => {
      if (!settled) { settled = true; clearTimeout(timer); reject(new Error('开发服务进程提前退出')) }
      else if (ready) onExit()
    })
  })
}
module.exports = { listenOwned, startOwnedChild }
