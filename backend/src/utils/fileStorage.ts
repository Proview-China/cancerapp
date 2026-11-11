import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { config } from '../config.js'

const STAGING_DIRECTORY = '.staging'
const SAFE_EXTENSIONS = new Set(['.bmp', '.gif', '.jpeg', '.jpg', '.png', '.tif', '.tiff', '.webp'])

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
  commit?: typeof commitNoReplace
  cleanup?: typeof removeOwnedStagingFile
}

type StorageDiagnostic = {
  stage: string
  operation: string
  errorName: string
  errorCode?: string
  storageKey?: string
}

const storageDiagnostic = (stage: string, operation: string, error: unknown, storageKey?: string): StorageDiagnostic => {
  const candidate = error as { name?: unknown; code?: unknown } | null
  const diagnostic: StorageDiagnostic = {
    stage,
    operation,
    errorName: typeof candidate?.name === 'string' ? candidate.name : 'Error',
  }
  if (typeof candidate?.code === 'string') diagnostic.errorCode = candidate.code
  if (storageKey) diagnostic.storageKey = storageKey
  return diagnostic
}

const decodeStorageKey = (value: string) => {
  let decoded = value
  for (let index = 0; index < 3; index += 1) {
    let next: string
    try {
      next = decodeURIComponent(decoded)
    } catch {
      throw new Error('存储路径编码无效')
    }
    if (next === decoded) return decoded
    decoded = next
  }
  return decoded
}

const assertSafeRelativeKey = (key: string) => {
  const decoded = decodeStorageKey(key).replace(/\\/g, '/')
  if (!decoded || path.posix.isAbsolute(decoded) || path.win32.isAbsolute(decoded)) {
    throw new Error('存储路径必须是非空相对路径')
  }
  const components = decoded.split('/')
  if (components.some((component: string) => component === '' || component === '.' || component === '..')) {
    throw new Error('存储路径包含非法组件')
  }
  return components.join(path.sep)
}

const assertWithinRoot = (root: string, candidate: string) => {
  const resolvedRoot = path.resolve(root)
  const resolvedCandidate = path.resolve(candidate)
  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('存储路径超出根目录')
  }
  return resolvedCandidate
}

const assertNoSymlinkComponents = async (root: string, candidate: string) => {
  const resolvedRoot = path.resolve(root)
  const resolvedCandidate = assertWithinRoot(resolvedRoot, candidate)
  const rootStat = await fs.lstat(resolvedRoot)
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error('存储根目录无效')
  const relative = path.relative(resolvedRoot, resolvedCandidate)
  let current = resolvedRoot
  for (const component of relative ? relative.split(path.sep) : []) {
    current = path.join(current, component)
    try {
      if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('存储路径不能经过符号链接')
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
  return resolvedCandidate
}

const ensureDirectory = async (directory: string) => {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 })
  const stat = await fs.lstat(directory)
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('存储目录无效')
  if (process.platform === 'linux') await fs.chmod(directory, 0o700)
}

export const normalizeStorageExtension = (originalName: string) => {
  const extension = path.extname(path.basename(originalName)).toLowerCase()
  return SAFE_EXTENSIONS.has(extension) ? extension : ''
}

const uploadsRoot = () => path.resolve(config.uploadsRoot)
const stagingRoot = () => path.join(uploadsRoot(), STAGING_DIRECTORY)

export const resolveStoragePath = async (publicPath: string, root = uploadsRoot()) => {
  const decoded = decodeStorageKey(publicPath)
  const prefix = '/uploads/'
  if (!decoded.startsWith(prefix)) throw new Error('存储路径格式无效')
  const relativeKey = assertSafeRelativeKey(decoded.slice(prefix.length))
  return assertNoSymlinkComponents(root, path.join(root, relativeKey))
}

export const storeFile = async (
  file: Express.Multer.File,
  _options: StoreFileOptions = {},
): Promise<StoredFile> => {
  const root = uploadsRoot()
  await ensureDirectory(root)
  await ensureDirectory(stagingRoot())
  const extension = normalizeStorageExtension(file.originalname)
  const filename = `${crypto.randomUUID()}${extension}`
  const absolutePath = await assertNoSymlinkComponents(root, path.join(root, filename))
  const stagingPath = path.join(stagingRoot(), `${crypto.randomUUID()}.upload`)
  await assertNoSymlinkComponents(root, stagingPath)
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined
  try {
    handle = await fs.open(stagingPath, 'wx', 0o600)
    await handle.writeFile(file.buffer)
    await handle.close()
    handle = undefined
    await ( _options.commit ?? commitNoReplace)(stagingPath, absolutePath)
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined)
    try {
      await (_options.cleanup ?? removeOwnedStagingFile)(stagingPath)
    } catch (cleanupError) {
      console.warn('清理 staging 文件失败', storageDiagnostic('failure', 'cleanup-staging', cleanupError, path.basename(stagingPath)))
    }
    throw error
  }
  return {
    storedPath: absolutePath,
    publicPath: `/uploads/${filename}`,
  }
}

export const commitNoReplace = async (
  stagingPath: string,
  targetPath: string,
  link: typeof fs.link = fs.link,
  unlink: typeof fs.unlink = fs.unlink,
) => {
  try {
    await link(stagingPath, targetPath)
  } catch (error) {
    console.warn('文件提交失败', storageDiagnostic('commit', 'link-no-replace', error, path.basename(targetPath)))
    throw error
  }
  try {
    await unlink(stagingPath)
  } catch (error) {
    console.warn('清理 staging 文件失败', storageDiagnostic('post-commit', 'cleanup-staging', error, path.basename(stagingPath)))
  }
}

const removeOwnedStagingFile = async (stagingPath: string) => {
  try {
    await fs.unlink(stagingPath)
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.warn('清理 staging 文件失败', storageDiagnostic('failure', 'cleanup-staging', error, path.basename(stagingPath)))
    }
  }
}

export const deleteStoredFile = async (publicPath: string | null | undefined) => {
  if (!publicPath) return
  const absolutePath = await resolveStoragePath(publicPath)
  try {
    if ((await fs.lstat(absolutePath)).isSymbolicLink()) throw new Error('存储路径不能指向符号链接')
    await fs.unlink(absolutePath)
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.warn('删除文件失败', storageDiagnostic('delete', 'unlink', error, publicPath))
    }
  }
}

export const isStagingRequestPath = (requestPath: string) => {
  let decoded = requestPath
  try {
    for (let index = 0; index < 3; index += 1) {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    }
  } catch {
    return true
  }
  const normalized = decoded.replace(/\\/g, '/').replace(/\/+/g, '/')
  return normalized.split('/').filter(Boolean).includes(STAGING_DIRECTORY)
}
