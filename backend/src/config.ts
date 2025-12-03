import dotenv from 'dotenv'
import path from 'node:path'

dotenv.config()

const DEFAULT_PORT = 4000
const DEFAULT_UPLOADS_ROOT = path.resolve(process.cwd(), '..', 'uploads')
const DEFAULT_DEEPSEEK_BASE = 'https://api.deepseek.com/v1'

export const config = {
  port: Number(process.env.PORT ?? DEFAULT_PORT),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:aass0371@localhost:5432/cancerapp',
  uploadsRoot: path.resolve(process.cwd(), process.env.UPLOADS_ROOT ?? DEFAULT_UPLOADS_ROOT),
  ai: {
    defaultBaseUrl: process.env.DEEPSEEK_API_BASE ?? DEFAULT_DEEPSEEK_BASE,
    defaultModel: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
    defaultTemperature: Number.isNaN(Number(process.env.DEEPSEEK_TEMPERATURE))
      ? 0.7
      : Number(process.env.DEEPSEEK_TEMPERATURE),
    apiKey: process.env.DEEPSEEK_API_KEY ?? null,
    configPath: process.env.AI_CONFIG_PATH ?? path.resolve(process.cwd(), 'ai-config.json'),
    timeoutMs: Number.isNaN(Number(process.env.DEEPSEEK_TIMEOUT_MS))
      ? 60000
      : Number(process.env.DEEPSEEK_TIMEOUT_MS),
    maxContentLength: Number.isNaN(Number(process.env.AI_MAX_CONTENT_LENGTH))
      ? 8000
      : Number(process.env.AI_MAX_CONTENT_LENGTH),
  },
}
