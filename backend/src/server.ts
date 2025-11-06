import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import { casesRouter } from './routes/cases.js'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/uploads', express.static(config.uploadsRoot))

app.use('/cases', casesRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('未捕获错误', err)
  res.status(500).json({ message: '服务器内部错误' })
})

app.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`)
  console.log(`静态文件目录: ${config.uploadsRoot}`)
})
