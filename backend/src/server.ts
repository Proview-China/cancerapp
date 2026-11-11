import { config } from './config.js'
import { app } from './app.js'
const server = app.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`)
  console.log(`静态文件目录: ${config.uploadsRoot}`)
})
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => server.close(() => process.exit(0)))
