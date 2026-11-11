import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import { casesRouter } from './routes/cases.js'
import { aiRouter } from './routes/ai.js'
import { authRouter } from './routes/auth.js'
import { isStagingRequestPath, resolveStoragePath } from './utils/fileStorage.js'

export const createApp = () => {
  const app = express()

  const allowedOrigins = new Set((process.env.AUTH_ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((value) => value.trim()).filter(Boolean))
  app.locals.allowedOrigins = allowedOrigins
  app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)), credentials: true }))
  app.use(express.json())

  app.use('/uploads', async (req, res, next) => {
    if (isStagingRequestPath(req.path)) {
      res.sendStatus(404)
      return
    }
    try {
      await resolveStoragePath(`/uploads${req.path}`)
      next()
    } catch {
      res.sendStatus(404)
    }
  }, express.static(config.uploadsRoot))

  app.use('/cases', casesRouter)
  app.use('/ai', aiRouter)
  app.use('/auth', authRouter)

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('未捕获错误', err)
    res.status(500).json({ message: '服务器内部错误' })
  })

  return app
}

export const app = createApp()
