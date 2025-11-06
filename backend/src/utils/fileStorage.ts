import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { config } from '../config.js'

const ensureUploadsRoot = async () => {
  await fs.mkdir(config.uploadsRoot, { recursive: true })
}

export type StoredFile = {
  storedPath: string
  publicPath: string
}

export const sanitizeSegment = (value: string) => {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{Letter}\p{Number}_-]+/gu, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized || 'file'
}

type StoreFileOptions = {
  baseName?: string
}

export const storeFile = async (
  file: Express.Multer.File,
  options: StoreFileOptions = {},
): Promise<StoredFile> => {
  await ensureUploadsRoot()
  const extension = path.extname(file.originalname) || ''
  const token = crypto.randomUUID()
  const base = options.baseName ? sanitizeSegment(options.baseName) : token
  const filename = `${base}${extension}`
  const absolutePath = path.join(config.uploadsRoot, filename)
  await fs.writeFile(absolutePath, file.buffer)
  return {
    storedPath: absolutePath,
    publicPath: `/uploads/${filename}`,
  }
}

export const deleteStoredFile = async (publicPath: string | null | undefined) => {
  if (!publicPath) return
  const filename = publicPath.replace(/^\/?uploads\//, '')
  if (!filename) return
  const absolutePath = path.join(config.uploadsRoot, filename)
  try {
    await fs.unlink(absolutePath)
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.warn('删除文件失败', absolutePath, error)
    }
  }
}
