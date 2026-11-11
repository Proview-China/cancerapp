import { describe, expect, it } from 'vitest'
import { normalizeUsername } from '../src/auth/username.js'
import { ARGON2_OPTIONS, hashPassword, verifyPassword } from '../src/auth/password.js'
import { clearLoginFailures, checkLoginRate, recordLoginFailure } from '../src/auth/rateLimit.js'

describe('认证基础安全规则', () => {
  it('规范化用户名并拒绝空值和超长值', () => {
    expect(normalizeUsername('  Admin  ')).toBe('admin')
    expect(normalizeUsername('Ａdmin')).toBe('admin')
    expect(normalizeUsername('\tADMIN\r')).toBe('admin')
    expect(() => normalizeUsername('a\u0000b')).toThrow()
    expect(() => normalizeUsername('a\u200bb')).toThrow()
    expect(() => normalizeUsername('')).toThrow()
    expect(() => normalizeUsername('a'.repeat(65))).toThrow()
  })

  it('使用 Argon2id 生成不可逆密码哈希', async () => {
    const password = 'correct horse battery staple'
    const hash = await hashPassword(password)
    expect(hash.startsWith('$argon2id$')).toBe(true)
    expect(await verifyPassword(hash, password)).toBe(true)
    expect(await verifyPassword(hash, 'wrong password')).toBe(false)
    expect(ARGON2_OPTIONS.memoryCost).toBe(64 * 1024)
    expect(ARGON2_OPTIONS.timeCost).toBe(3)
    expect(ARGON2_OPTIONS.parallelism).toBe(1)
  }, 30_000)

  it('第五次失败仍可认证失败，第六次开始限流，并可成功后清除', () => {
    const username = `rate-${Date.now()}`
    clearLoginFailures(username)
    for (let i = 0; i < 5; i += 1) {
      expect(checkLoginRate(username, '127.0.0.1')).toBe(false)
      recordLoginFailure(username, '127.0.0.1')
    }
    expect(checkLoginRate(username, '127.0.0.1')).toBe(true)
    clearLoginFailures(username)
    expect(checkLoginRate(username, '127.0.0.1')).toBe(false)
  })
})
