const path = require('node:path')
const http = require('node:http')
const fs = require('node:fs/promises')
const os = require('node:os')
const { pathToFileURL } = require('node:url')
const { listenOwned } = require('./startup.cjs')

async function main() {
  const frontend = path.resolve(__dirname, '..')
  const backend = path.resolve(frontend, '..', 'backend')
  process.chdir(backend)
  process.env.AUTH_ALLOWED_ORIGINS = 'http://127.0.0.1:4000'
  // Load current TypeScript sources without touching existing build output.
  require(path.join(backend, 'node_modules', 'tsx', 'dist', 'cjs', 'api', 'index.cjs')).register()
  const { app } = require(path.join(backend, 'src', 'app.ts'))
  const { createServer } = await import(pathToFileURL(path.join(frontend, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href)
  const server = http.createServer(app)
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cancerapp-vite-'))
  const vite = await createServer({ root: frontend, cacheDir, logLevel: 'silent', server: { middlewareMode: true, hmr: { server } }, appType: 'spa' })
  app.use(vite.middlewares)
  await listenOwned(server, 4000, '127.0.0.1', () => process.exit(1))
  process.send?.({ type: 'ready' })
  process.on('disconnect', () => { void vite.close().finally(() => server.close(() => process.exit(0))) })
}
main().catch(error => {
  process.send?.({ type: 'error', code: error && error.code === 'EADDRINUSE' ? 'EADDRINUSE' : 'START_FAILED' }, () => process.exit(1))
  if (!process.send) process.exit(1)
})
