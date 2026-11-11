import { afterEach, describe, expect, it, vi } from 'vitest'

const fixtures = vi.hoisted(() => ({ owner: 0, mode: 0o600, content: '', missing: false }))
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  const info = (directory: boolean) => ({ uid: fixtures.owner, mode: directory ? 0o755 : fixtures.mode, isDirectory: () => directory, isFile: () => !directory })
  return { ...actual, lstat: vi.fn(async (name: string) => {
    if (fixtures.missing) throw Object.assign(new Error('missing'), { code: 'ENOENT' })
    return info(name !== '/controlled/targets.json')
  }), open: vi.fn(async () => ({ stat: async () => info(false), readFile: async () => fixtures.content, close: async () => {} })) }
})

import { assertAllowedDatabaseTarget, getDatabaseTarget, assertBackendStopped } from '../src/auth/operationGuard.js'

const original = process.env.AUTH_TARGET_CONFIG
const allowed = { host: '127.0.0.1', port: 5433, database: 'cancerapp_test', user: 'cancerapp_test_app', purpose: 'migration' }
afterEach(() => { if (original === undefined) delete process.env.AUTH_TARGET_CONFIG; else process.env.AUTH_TARGET_CONFIG = original; fixtures.owner = 0; fixtures.mode = 0o600; fixtures.missing = false })

describe('受控目标配置', () => {
  it('匹配完整目标并拒绝环境变量替换及未知目标', async () => {
    process.env.AUTH_TARGET_CONFIG = '/controlled/targets.json'
    fixtures.content = JSON.stringify([allowed])
    await expect(assertAllowedDatabaseTarget(allowed, 'migration')).resolves.toMatchObject(allowed)
    for (const change of [{ host: 'example.org' }, { port: 5434 }, { port: 5432 }, { database: 'other' }, { user: 'other' }]) {
      await expect(assertAllowedDatabaseTarget({ ...allowed, ...change }, 'migration')).rejects.toThrow()
    }
    process.env.AUTH_ALLOWED_DATABASE_TARGETS = JSON.stringify([{ ...allowed, host: 'example.org' }])
    await expect(assertAllowedDatabaseTarget({ ...allowed, host: 'example.org' }, 'migration')).rejects.toThrow()
    delete process.env.AUTH_ALLOWED_DATABASE_TARGETS
  })
  it('拒绝权限过宽、错误所有者、缺失或不完整配置', async () => {
    process.env.AUTH_TARGET_CONFIG = '/controlled/targets.json'
    fixtures.content = JSON.stringify([allowed])
    fixtures.mode = 0o666
    await expect(assertAllowedDatabaseTarget(allowed, 'migration')).rejects.toThrow()
    fixtures.mode = 0o600; fixtures.owner = 1234
    await expect(assertAllowedDatabaseTarget(allowed, 'migration')).rejects.toThrow()
    fixtures.owner = 0; fixtures.missing = true
    await expect(assertAllowedDatabaseTarget(allowed, 'migration')).rejects.toThrow()
    fixtures.missing = false; fixtures.content = JSON.stringify([{ ...allowed, user: '' }])
    await expect(assertAllowedDatabaseTarget(allowed, 'migration')).rejects.toThrow()
    expect(() => getDatabaseTarget(undefined)).toThrow()
  })
  it('无法证明停止状态时拒绝管理操作', async () => {
    await expect(assertBackendStopped()).rejects.toThrow('shared lifecycle lock')
  })
})
