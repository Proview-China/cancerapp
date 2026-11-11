import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

const mocks = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn(), verify: vi.fn(), hash: vi.fn(), find: vi.fn() }))
vi.mock('../src/db/pool.js', () => ({ pool: { query: mocks.query, connect: mocks.connect } }))
vi.mock('../src/auth/password.js', () => ({ verifyPassword: mocks.verify, hashPassword: mocks.hash }))
vi.mock('../src/auth/session.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/auth/session.js')>()
  return { ...original, findSession: mocks.find }
})
import { createApp } from '../src/app.js'
import { clearLoginFailures } from '../src/auth/rateLimit.js'

const origin = 'http://localhost:5173'
const user = { id: 'user-1', username: 'admin', role: 'admin', sessionId: 'session-1' }
const app = createApp()

async function bootstrap() {
  const r = await request(app).get('/auth/csrf')
  return { token: r.body.token as string, cookie: (r.headers['set-cookie'] as unknown as string[])[0].split(';')[0] }
}
async function login(username: string, password: string) {
  const csrf = await bootstrap()
  return request(app).post('/auth/login').set('Origin', origin).set('Cookie', csrf.cookie).set('X-CSRF-Token', csrf.token).send({ username, password })
}
async function sessionCsrf() {
  const { issueCsrf } = await import('../src/auth/csrf.js')
  const headers: Record<string, unknown> = {}
  return issueCsrf({ getHeader: (key: string) => headers[key], setHeader: (key: string, value: unknown) => { headers[key] = value } } as never, user.sessionId)
}
function statusRequest(token: string) {
  return request(app).patch('/auth/users/other/status').set('Origin', origin).set('Cookie', ['cancerapp_session=test', `cancerapp_csrf=${token}`]).set('X-CSRF-Token', token)
}

describe('认证 HTTP 接口和事务替身', () => {
  beforeEach(() => { vi.clearAllMocks(); clearLoginFailures('admin'); mocks.find.mockResolvedValue(user); mocks.verify.mockResolvedValue(true); mocks.hash.mockResolvedValue('new-hash') })

  it('退出时仅对可信来源的已过期会话令牌标记过期，并可恢复后退出', async () => {
    const now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    try {
      const token = await sessionCsrf()
      clock.mockReturnValue(now + 600001)
      const send = (value: string, source: string) => request(app).post('/auth/logout').set('Origin', source).set('Cookie', ['cancerapp_session=test', `cancerapp_csrf=${value}`]).set('X-CSRF-Token', value)
      expect((await send(token, 'null')).body.code).toBeUndefined()
      expect((await send('wrong', origin)).body.code).toBeUndefined()
      expect((await send(token, origin)).body.code).toBe('CSRF_EXPIRED')
      const restored = await request(app).post('/auth/csrf/session').set('Origin', origin).set('Cookie', 'cancerapp_session=test').send({})
      expect(restored.status).toBe(200)
      mocks.query.mockResolvedValue({ rows: [], rowCount: 1 })
      expect((await send(restored.body.token, origin)).status).toBe(204)
    } finally { clock.mockRestore() }
  })

  it.each(['revoked', 'expired'] as const)('会话 %s 时拒绝恢复 CSRF 且不签发令牌（数据库查询替身）', async (state) => {
    const actual = await vi.importActual<typeof import('../src/auth/session.js')>('../src/auth/session.js')
    mocks.find.mockImplementation(actual.findSession)
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sessions s JOIN users u')) {
        // 模拟数据库对 revoked_at IS NULL 的过滤；不执行真实 SQL。
        return { rows: state === 'revoked' ? [] : [{ id: user.id, username: user.username, role: user.role, session_id: user.sessionId, expires_at: new Date(Date.now() - 1000), last_seen_at: new Date() }] }
      }
      return { rows: [], rowCount: 1 }
    })
    const response = await request(app).post('/auth/csrf/session').set('Origin', origin).set('Cookie', 'cancerapp_session=test').send({})
    expect(response.status).toBe(401)
    expect(response.body).not.toHaveProperty('token')
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(mocks.query.mock.calls[0][0]).toContain('s.revoked_at IS NULL')
    if (state === 'expired') expect(mocks.query.mock.calls.some(([sql]) => String(sql).startsWith('UPDATE sessions SET revoked_at'))).toBe(true)
  })

  it('登录后刷新并恢复会话令牌，随后完成状态变更', async () => {
    vi.useFakeTimers({ now: Date.now() - 1_800_000 })
    try {
      mocks.query.mockResolvedValue({ rows: [{ id: user.id, username: 'admin', password_hash: 'hash', is_active: true }] })
      const signedIn = await login('admin', 'correct')
      expect(signedIn.status).toBe(200)
      const session = (signedIn.headers['set-cookie'] as unknown as string[]).find(c => c.startsWith('cancerapp_session='))!.split(';')[0]
      const restored = await request(app).post('/auth/csrf/session').set('Origin', origin).set('Cookie', session).send({})
      expect(restored.status).toBe(200)
      const csrfCookie = (restored.headers['set-cookie'] as unknown as string[])[0].split(';')[0]
      const client = { query: vi.fn(async (sql: string) => sql.startsWith('SELECT role') ? { rows: [{ role: 'researcher', is_active: true }] } : { rows: [], rowCount: 1 }), release: vi.fn() }
      mocks.connect.mockResolvedValue(client)
      expect((await request(app).patch('/auth/users/other/status').set('Origin', origin).set('Cookie', [session, csrfCookie]).set('X-CSRF-Token', restored.body.token).send({ isActive: true })).status).toBe(204)
      for (const badOrigin of ['null', 'http://evil.example']) expect((await request(app).post('/auth/csrf/session').set('Origin', badOrigin).set('Cookie', session).send({})).status).toBe(403)
      expect((await request(app).post('/auth/csrf/session').set('Cookie', session).send({})).status).toBe(403)
      mocks.find.mockResolvedValue(null)
      expect((await request(app).post('/auth/csrf/session').set('Origin', origin).set('Cookie', session).send({})).status).toBe(401)
    } finally { vi.useRealTimers() }
  })

  it('缺失或错误 CSRF 与格式错误均计入来源限速且不能绕过校验', async () => {
    vi.useFakeTimers({ now: Date.now() - 900_000 })
    try {
      for (let i = 0; i < 30; i++) {
        const csrf = await bootstrap()
        const r = await request(app).post('/auth/login').set('Origin', origin).set('Cookie', csrf.cookie).set('X-CSRF-Token', i % 3 === 0 ? '' : i % 3 === 1 ? 'wrong' : csrf.token).send({ username: '', password: '' })
        expect(r.status).toBe(i % 3 === 2 ? 401 : 403)
      }
      const blocked = await request(app).post('/auth/login').set('Origin', origin).send({})
      expect(blocked.status).toBe(429)
      expect(blocked.headers['retry-after']).toBe('60')
    } finally { vi.useRealTimers() }
  })

  it('第六次失败开始限速且统一响应不泄露账户', async () => {
    mocks.query.mockResolvedValue({ rows: [] })
    for (let i = 0; i < 5; i++) expect((await login('admin', 'bad')).status).toBe(401)
    const blocked = await login('admin', 'bad')
    expect(blocked.status).toBe(429)
    expect(blocked.headers['retry-after']).toBeTruthy()
  })

  it('NFKC 用户名传递到登录查询', async () => {
    mocks.query.mockResolvedValue({ rows: [] })
    expect((await login('  ＡＤＭＩＮ  ', 'bad')).status).toBe(401)
    expect(mocks.query.mock.calls[0][1]).toEqual(['admin'])
  })

  it('不存在账户与错误密码响应一致，成功后清除用户名失败计数', async () => {
    vi.useFakeTimers({ now: Date.now() + 300_000 })
    try {
      mocks.query.mockResolvedValue({ rows: [] })
      const missing = await login('admin', 'bad')
      mocks.query.mockResolvedValue({ rows: [{ id: user.id, username: 'admin', password_hash: 'hash', is_active: true }] })
      mocks.verify.mockResolvedValue(false)
      const wrong = await login('admin', 'bad')
      expect(wrong.status).toBe(missing.status)
      expect(wrong.body).toEqual(missing.body)
      mocks.verify.mockResolvedValue(true)
      expect((await login('admin', 'correct')).status).toBe(200)
      mocks.verify.mockResolvedValue(false)
      for (let i = 0; i < 5; i++) expect((await login('admin', 'bad')).status).toBe(401)
      expect((await login('admin', 'bad')).status).toBe(429)
    } finally { vi.useRealTimers() }
  })

  it('来源限流计入格式错误、不存在账户及错误密码', async () => {
    vi.useFakeTimers({ now: Date.now() + 600_000 })
    try {
      for (let i = 0; i < 30; i++) {
        const kind = i % 3
        mocks.query.mockResolvedValue({ rows: kind === 2 ? [{ id: 'u', username: `u${i}`, password_hash: 'hash', is_active: true }] : [] })
        mocks.verify.mockResolvedValue(false)
        expect((await login(kind === 0 ? '' : `u${i}`, 'bad')).status).toBe(401)
      }
      expect((await login('another', 'bad')).status).toBe(429)
    } finally { vi.useRealTimers() }
  })

  it('来源限流覆盖格式错误并忽略未信任转发头', async () => {
    vi.useFakeTimers({ now: Date.now() + 900_000 })
    try {
      for (let i = 0; i < 30; i++) expect((await login('', 'bad')).status).toBe(401)
      const csrf = await bootstrap()
      const r = await request(app).post('/auth/login').set('Origin', origin).set('X-Forwarded-For', '203.0.113.77').set('Cookie', csrf.cookie).set('X-CSRF-Token', csrf.token).send({ username: '', password: 'bad' })
      expect(r.status).toBe(429)
      expect(r.headers['retry-after']).toBe('60')
    } finally { vi.useRealTimers() }
  })

  it('账户状态提前返回回滚并释放连接', async () => {
    const client = { query: vi.fn(async (sql: string) => sql.startsWith('SELECT role') ? { rows: [] } : { rows: [] }), release: vi.fn() }
    mocks.connect.mockResolvedValue(client)
    const { issueCsrf } = await import('../src/auth/csrf.js')
    const headers: Record<string, unknown> = {}
    const token = issueCsrf({ getHeader: (key: string) => headers[key], setHeader: (key: string, value: unknown) => { headers[key] = value } } as never, user.sessionId)
    const r = await request(app).patch('/auth/users/other/status').set('Origin', origin).set('Cookie', [`cancerapp_session=test`, `cancerapp_csrf=${token}`]).set('X-CSRF-Token', token).send({ isActive: false })
    expect(r.status).toBe(404)
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    expect(client.release).toHaveBeenCalledOnce()
  })

  it.each(['missing', 'last-admin', 'update-failure'])('账户事务 %s 回滚并释放连接', async (mode) => {
    const client = { query: vi.fn(async (sql: string) => {
      if (sql.startsWith('SELECT role')) return { rows: mode === 'missing' ? [] : [{ role: 'admin', is_active: true }] }
      if (sql.includes('SELECT id FROM users')) return { rows: [{ id: 'other' }], rowCount: mode === 'last-admin' ? 1 : 2 }
      if (sql.startsWith('UPDATE users') && mode === 'update-failure') throw new Error('private-secret')
      return { rows: [], rowCount: 1 }
    }), release: vi.fn() }
    mocks.connect.mockResolvedValue(client)
    const token = await sessionCsrf()
    const r = await statusRequest(token).send({ isActive: false })
    expect(r.status).toBe(mode === 'missing' ? 404 : mode === 'last-admin' ? 400 : 500)
    expect(r.text).not.toContain('private-secret')
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    expect(client.query).not.toHaveBeenCalledWith('COMMIT')
    expect(client.release).toHaveBeenCalledOnce()
  })

  it('会话 CSRF 可用于连续状态变更', async () => {
    const client = { query: vi.fn(async (sql: string) => sql.startsWith('SELECT role') ? { rows: [{ role: 'researcher', is_active: true }] } : { rows: [], rowCount: 1 }), release: vi.fn() }
    mocks.connect.mockResolvedValue(client)
    const token = await sessionCsrf()
    expect((await statusRequest(token).send({ isActive: true })).status).toBe(204)
    expect((await statusRequest(token).send({ isActive: true })).status).toBe(204)
    expect(client.release).toHaveBeenCalledTimes(2)
  })

  it.each(['UPDATE users SET password_hash', 'UPDATE sessions SET revoked_at'])('改密阶段 %s 失败会回滚并释放连接', async (failure) => {
    const client = { query: vi.fn(async (sql: string) => { if (sql.includes(failure)) throw new Error('private-secret'); return { rows: [], rowCount: 1 } }), release: vi.fn() }
    mocks.connect.mockResolvedValue(client)
    mocks.query.mockResolvedValue({ rows: [{ password_hash: 'old-hash' }] })
    const csrf = await bootstrap()
    const { issueCsrf } = await import('../src/auth/csrf.js')
    const headers: Record<string, unknown> = {}
    const token = issueCsrf({ getHeader: (key: string) => headers[key], setHeader: (key: string, value: unknown) => { headers[key] = value } } as never, user.sessionId)
    const response = await request(app).post('/auth/password').set('Origin', origin).set('Cookie', [`cancerapp_session=test`, `cancerapp_csrf=${token}`]).set('X-CSRF-Token', token).send({ currentPassword: 'old', newPassword: 'new-password-long' })
    expect(response.status).toBe(500)
    expect(response.text).not.toContain('private-secret')
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    expect(client.query).not.toHaveBeenCalledWith('COMMIT')
    expect(client.release).toHaveBeenCalledOnce()
    expect(csrf.token).toBeTruthy()
  })

  it('改密成功后提交密码与会话撤销，清除 Cookie 并要求重新登录', async () => {
    const client = { query: vi.fn(async () => ({ rows: [], rowCount: 1 })), release: vi.fn() }
    mocks.connect.mockResolvedValue(client)
    mocks.query.mockResolvedValue({ rows: [{ password_hash: 'old-hash' }] })
    const token = await sessionCsrf()
    const response = await request(app).post('/auth/password').set('Origin', origin).set('Cookie', ['cancerapp_session=test', `cancerapp_csrf=${token}`]).set('X-CSRF-Token', token).send({ currentPassword: 'old', newPassword: 'new-password-long' })
    expect(response.status).toBe(204)
    expect(client.query.mock.calls.map(([sql]) => String(sql))).toEqual(expect.arrayContaining(['BEGIN', 'COMMIT']))
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO sessions'))).toBe(false)
    expect(client.query).not.toHaveBeenCalledWith('ROLLBACK')
    expect(client.release).toHaveBeenCalledOnce()
    expect((response.headers['set-cookie'] as unknown as string[]).some(cookie => cookie.startsWith('cancerapp_session=;') && cookie.includes('Max-Age=0'))).toBe(true)
  })
})
