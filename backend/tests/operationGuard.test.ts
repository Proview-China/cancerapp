import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { acquireExclusiveLock, assertAllowedDatabaseTarget, getDatabaseTarget, targetSummary } from '../src/auth/operationGuard.js'

const originalTargets = process.env.AUTH_ALLOWED_DATABASE_TARGETS
const temporaryDirectories: string[] = []

afterEach(() => {
  if (originalTargets === undefined) delete process.env.AUTH_ALLOWED_DATABASE_TARGETS
  else process.env.AUTH_ALLOWED_DATABASE_TARGETS = originalTargets
  return Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('认证操作目标边界', () => {
  it('不把旧环境变量视为授权配置', async () => {
    process.env.AUTH_ALLOWED_DATABASE_TARGETS = JSON.stringify([{ host: '127.0.0.1', port: 5433, database: 'cancerapp_test', user: 'cancerapp_test_app' }])
    const target = getDatabaseTarget('postgres://cancerapp_test_app:secret@127.0.0.1:5433/cancerapp_test')
    expect(targetSummary(target)).toBe('cancerapp_test_app@127.0.0.1:5433/cancerapp_test')
    await expect(assertAllowedDatabaseTarget(target, 'migration')).rejects.toThrow()
  })

  it('拒绝 5432、未知目标和缺失白名单', async () => {
    process.env.AUTH_ALLOWED_DATABASE_TARGETS = JSON.stringify([{ host: '127.0.0.1', port: 5433, database: 'cancerapp_test', user: 'cancerapp_test_app' }])
    await expect(assertAllowedDatabaseTarget(getDatabaseTarget('postgres://app:secret@127.0.0.1:5432/cancerapp_test'), 'migration')).rejects.toThrow()
    await expect(assertAllowedDatabaseTarget(getDatabaseTarget('postgres://app:secret@127.0.0.1:5434/cancerapp_test'), 'migration')).rejects.toThrow()
    delete process.env.AUTH_ALLOWED_DATABASE_TARGETS
    await expect(assertAllowedDatabaseTarget(getDatabaseTarget('postgres://app:secret@127.0.0.1:5433/cancerapp_test'), 'migration')).rejects.toThrow()
  })

  it('锁被占用时失败关闭，释放后可重试', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cancerapp-auth-lock-'))
    temporaryDirectories.push(directory)
    const lockPath = join(directory, 'operation.lock')
    const first = await acquireExclusiveLock(lockPath)
    await expect(acquireExclusiveLock(lockPath)).rejects.toThrow()
    await first.release()
    const second = await acquireExclusiveLock(lockPath)
    await second.release()
  })
})
