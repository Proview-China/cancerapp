import fs from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { config } from '../src/config.js'
import request from 'supertest'
import { createApp } from '../src/app.js'
import {
  commitNoReplace,
  deleteStoredFile,
  isStagingRequestPath,
  resolveStoragePath,
  normalizeStorageExtension,
  storeFile,
} from '../src/utils/fileStorage.js'

const makeFile = (name: string, content: string) => ({
  originalname: name,
  buffer: Buffer.from(content),
}) as Express.Multer.File

describe('文件存储安全边界', () => {
  let root: string
  let originalRoot: string

  beforeEach(async () => {
    originalRoot = config.uploadsRoot
    root = await fs.mkdtemp('/tmp/cancerapp-file-storage-')
    config.uploadsRoot = root
    await fs.mkdir(path.join(root, '.staging'), { recursive: true })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    config.uploadsRoot = originalRoot
    await fs.rm(root, { recursive: true, force: true })
  })

  it('拒绝绝对路径、穿越、编码穿越和非法存储格式', async () => {
    for (const value of ['/etc/passwd', '/uploads/../outside', '/uploads/%2e%2e/outside', 'uploads/foo']) {
      await expect(resolveStoragePath(value)).rejects.toThrow()
    }
  })

  it('拒绝符号链接目录和符号链接目标', async () => {
    await fs.mkdir(path.join(root, '.staging'), { recursive: true })
    await fs.symlink('/tmp', path.join(root, 'escape-dir'))
    await expect(resolveStoragePath('/uploads/escape-dir/file')).rejects.toThrow()
    await fs.writeFile(path.join(root, 'safe.txt'), 'safe')
    await fs.symlink(path.join(root, 'safe.txt'), path.join(root, 'target-link'))
      await expect(deleteStoredFile('/uploads/target-link')).rejects.toThrow()
    await expect(fs.readFile(path.join(root, 'safe.txt'), 'utf8')).resolves.toBe('safe')
  })

  it('收紧已有存储目录和 staging 目录权限，并拒绝符号链接根目录', async () => {
    await fs.chmod(root, 0o755)
    await fs.chmod(path.join(root, '.staging'), 0o755)
    await storeFile(makeFile('permissions.png', 'content'))
    expect((await fs.stat(root)).mode & 0o777).toBe(0o700)
    expect((await fs.stat(path.join(root, '.staging'))).mode & 0o777).toBe(0o700)

    const linkedRoot = await fs.mkdtemp('/tmp/cancerapp-linked-root-')
    const target = await fs.mkdtemp('/tmp/cancerapp-real-root-')
    await fs.rm(linkedRoot, { recursive: true, force: true })
    await fs.symlink(target, linkedRoot)
    const previousRoot = config.uploadsRoot
    config.uploadsRoot = linkedRoot
    try {
      await expect(storeFile(makeFile('linked.png', 'content'))).rejects.toThrow()
    } finally {
      config.uploadsRoot = previousRoot
      await fs.rm(linkedRoot, { recursive: true, force: true })
      await fs.rm(target, { recursive: true, force: true })
    }
  })

  it('只使用白名单扩展名并规范化文件名扩展', () => {
    expect(normalizeStorageExtension('file.png?x=1')).toBe('')
    expect(normalizeStorageExtension('file.tar.gz')).toBe('')
    expect(normalizeStorageExtension('file.')).toBe('')
    expect(normalizeStorageExtension('file')).toBe('')
    expect(normalizeStorageExtension('dir\\file.PNG')).toBe('.png')
    expect(normalizeStorageExtension('file\u0000.jpg')).toBe('.jpg')
    expect(normalizeStorageExtension('file.exe')).toBe('')
  })

  it('特殊文件名仍产生可访问的正式文件路径', async () => {
    for (const name of ['file.png?x=1', 'file.tar.gz', 'file.', 'file', 'dir/file.PNG', 'file\u0000.jpg', 'file.exe']) {
      const stored = await storeFile(makeFile(name, name))
      expect(stored.publicPath).toMatch(/^\/uploads\/[0-9a-f-]+(?:\.(?:bmp|gif|jpeg|jpg|png|tif|tiff|webp))?$/)
      await expect(fs.readFile(stored.storedPath, 'utf8')).resolves.toBe(name)
    }
  })

  it('使用随机名称、staging 独占写入并清理 staging', async () => {
    const first = await storeFile(makeFile('same.png', 'first'), { baseName: 'same' })
    const second = await storeFile(makeFile('same.png', 'second'), { baseName: 'same' })
    expect(first.publicPath).not.toBe(second.publicPath)
    expect(await fs.readFile(first.storedPath, 'utf8')).toBe('first')
    expect(await fs.readFile(second.storedPath, 'utf8')).toBe('second')
    expect(await fs.readdir(path.join(root, '.staging'))).toHaveLength(0)
  })

  it('fs.link 目标冲突返回 EEXIST 且不覆盖原文件', async () => {
    const staging = path.join(root, 'candidate')
    const target = path.join(root, 'existing')
    await fs.writeFile(staging, 'new')
    await fs.writeFile(target, 'old')
    await expect(commitNoReplace(staging, target)).rejects.toMatchObject({ code: 'EEXIST' })
    await expect(fs.readFile(target, 'utf8')).resolves.toBe('old')
    await fs.rm(staging)
  })

  it('并发提交同一目标最多一个成功', async () => {
    const target = path.join(root, 'race-target')
    const stagingFiles = await Promise.all([...Array(8)].map(async (_, index) => {
      const file = path.join(root, `race-${index}`)
      await fs.writeFile(file, `content-${index}`)
      return file
    }))
    const results = await Promise.allSettled(stagingFiles.map((file) => commitNoReplace(file, target)))
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect((await fs.readFile(target, 'utf8')).startsWith('content-')).toBe(true)
    await Promise.all(stagingFiles.map((file) => fs.rm(file, { force: true })))
  })

  it('EXDEV、EPERM 和不支持错误失败关闭', async () => {
    for (const code of ['EXDEV', 'EPERM', 'ENOSYS']) {
      const staging = path.join(root, `failure-${code}`)
      const target = path.join(root, `target-${code}`)
      await fs.writeFile(staging, 'candidate')
      const link = async () => { throw Object.assign(new Error(code), { code }) }
      await expect(commitNoReplace(staging, target, link)).rejects.toMatchObject({ code })
      await expect(fs.readFile(staging, 'utf8')).resolves.toBe('candidate')
      await fs.rm(staging)
      await expect(fs.access(target)).rejects.toThrow()
    }
  })

  it('拒绝 staging 静态访问的编码和重复分隔符变体', () => {
    expect(isStagingRequestPath('/.staging/file')).toBe(true)
    expect(isStagingRequestPath('/%2estaging//file')).toBe(true)
    expect(isStagingRequestPath('/foo/%2E%73taging/file')).toBe(true)
    expect(isStagingRequestPath('/legacy/file.png')).toBe(false)
  })

  it('通过 Express HTTP 层拒绝 staging 并保留合法文件访问', async () => {
    const staging = path.join(root, '.staging')
    await fs.mkdir(staging, { recursive: true })
    await fs.writeFile(path.join(staging, 'private.txt'), 'private')
    await fs.writeFile(path.join(root, 'legacy.png'), 'legacy')
    await fs.writeFile(path.join(root, 'new-file.png'), 'new')
    const outsideDirectory = await fs.mkdtemp('/tmp/cancerapp-outside-')
    await fs.writeFile(path.join(outsideDirectory, 'secret.txt'), 'secret')
    await fs.symlink(path.join(outsideDirectory, 'secret.txt'), path.join(root, 'outside-link.txt'))

    try {
      const app = createApp()
      for (const url of [
        '/uploads/.staging/private.txt',
        '/uploads/%2estaging/private.txt',
        '/uploads/foo//.staging/private.txt',
      ]) {
        await request(app).get(url).expect(404)
      }
      await request(app).get('/uploads/legacy.png').expect(200).expect((response) => {
        expect(response.body.toString()).toBe('legacy')
      })
      await request(app).get('/uploads/new-file.png').expect(200).expect((response) => {
        expect(response.body.toString()).toBe('new')
      })
      await request(app).get('/uploads/outside-link.txt').expect(404)
    } finally {
      await fs.rm(staging, { recursive: true, force: true })
      await fs.rm(outsideDirectory, { recursive: true, force: true })
    }
  })

  it('staging 写入失败时只清理当前请求文件', async () => {
    const otherStaging = path.join(root, '.staging', 'other-write.upload')
    await fs.writeFile(otherStaging, 'other')
    const file = {
      originalname: 'write-failure.png',
      get buffer(): Buffer {
        throw Object.assign(new Error('EIO'), { code: 'EIO' })
      },
    } as Express.Multer.File

    await expect(storeFile(file)).rejects.toMatchObject({ code: 'EIO' })
    expect(await fs.readdir(path.join(root, '.staging'))).toEqual(['other-write.upload'])
    expect(await fs.readFile(otherStaging, 'utf8')).toBe('other')
  })

  it('提交失败时只清理当前请求的 staging 文件', async () => {
    const otherStaging = path.join(root, '.staging', 'other.upload')
    await fs.writeFile(otherStaging, 'other')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await expect(storeFile(makeFile('failed.png', 'failed'), {
      commit: (stagingPath, targetPath) => commitNoReplace(
        stagingPath,
        targetPath,
        async () => { throw Object.assign(new Error('EXDEV'), { code: 'EXDEV' }) },
      ),
    })).rejects.toMatchObject({ code: 'EXDEV' })
    expect(await fs.readdir(path.join(root, '.staging'))).toEqual(['other.upload'])
    expect(warn).toHaveBeenCalledWith('文件提交失败', expect.objectContaining({
      stage: 'commit',
      operation: 'link-no-replace',
      errorName: 'Error',
      errorCode: 'EXDEV',
    }))
    expect(JSON.stringify(warn.mock.calls)).not.toContain(root)
    warn.mockRestore()
  })

  it('记录 staging 清理失败并保留其他请求文件', async () => {
    const otherStaging = path.join(root, '.staging', 'other-cleanup.upload')
    await fs.writeFile(otherStaging, 'other')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cleanup = async () => { throw Object.assign(new Error('EACCES'), { code: 'EACCES' }) }
    await expect(storeFile(makeFile('cleanup.png', 'cleanup'), {
      commit: async () => { throw Object.assign(new Error('EPERM'), { code: 'EPERM' }) },
      cleanup,
    })).rejects.toMatchObject({ code: 'EPERM' })
    expect(warn).toHaveBeenCalledWith('清理 staging 文件失败', expect.objectContaining({
      stage: 'failure',
      operation: 'cleanup-staging',
      errorName: 'Error',
      errorCode: 'EACCES',
      storageKey: expect.stringMatching(/\.upload$/),
    }))
    expect(JSON.stringify(warn.mock.calls)).not.toContain(root)
    expect(await fs.readFile(otherStaging, 'utf8')).toBe('other')
    warn.mockRestore()
  })

  it('提交成功后正式文件可读，staging 清理失败只记录诊断', async () => {
    const target = path.join(root, 'published')
    const staging = path.join(root, 'to-publish')
    await fs.writeFile(staging, 'published')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const unlink = async () => { throw Object.assign(new Error('EACCES'), { code: 'EACCES' }) }
    await expect(commitNoReplace(staging, target, fs.link, unlink)).resolves.toBeUndefined()
    await expect(fs.readFile(target, 'utf8')).resolves.toBe('published')
    expect(warn).toHaveBeenCalledWith('清理 staging 文件失败', expect.objectContaining({
      stage: 'post-commit',
      operation: 'cleanup-staging',
      errorName: 'Error',
      errorCode: 'EACCES',
    }))
    expect(JSON.stringify(warn.mock.calls)).not.toContain(root)
    warn.mockRestore()
    await fs.rm(staging, { force: true })
  })

  it('普通删除失败时只记录脱敏诊断且不影响其他文件', async () => {
    const target = path.join(root, 'delete-target.png')
    const other = path.join(root, 'other-file.png')
    const otherStaging = path.join(root, '.staging', 'other-request.upload')
    await fs.writeFile(target, 'target')
    await fs.writeFile(other, 'other')
    await fs.writeFile(otherStaging, 'other staging')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const unlink = vi.spyOn(fs, 'unlink').mockImplementation(async (filePath) => {
      if (filePath === target) throw Object.assign(new Error('EACCES'), { code: 'EACCES', path: target, dest: root })
      return undefined
    })

    try {
      await expect(deleteStoredFile('/uploads/delete-target.png')).resolves.toBeUndefined()
      expect(await fs.readFile(other, 'utf8')).toBe('other')
      expect(await fs.readFile(otherStaging, 'utf8')).toBe('other staging')
      expect(await fs.readFile(target, 'utf8')).toBe('target')
      expect(warn).toHaveBeenCalledWith('删除文件失败', expect.objectContaining({
        stage: 'delete',
        operation: 'unlink',
        errorName: 'Error',
        errorCode: 'EACCES',
        storageKey: '/uploads/delete-target.png',
      }))
      const serialized = JSON.stringify(warn.mock.calls)
      expect(serialized).not.toContain(root)
      expect(serialized).not.toContain('"path"')
      expect(serialized).not.toContain('"dest"')
      expect(serialized).not.toContain('stack')
    } finally {
      unlink.mockRestore()
      warn.mockRestore()
    }
  })
})
