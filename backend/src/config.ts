import dotenv from 'dotenv'
import path from 'node:path'

dotenv.config()

const DEFAULT_PORT = 4000
const DEFAULT_UPLOADS_ROOT = path.resolve(process.cwd(), '..', 'uploads')

export const config = {
  port: Number(process.env.PORT ?? DEFAULT_PORT),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:aass0371@localhost:5432/cancerapp',
  uploadsRoot: path.resolve(process.cwd(), process.env.UPLOADS_ROOT ?? DEFAULT_UPLOADS_ROOT),
}
