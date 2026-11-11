import { Router } from 'express'
import { pool } from '../db/pool.js'
import { hashPassword, verifyPassword } from '../auth/password.js'
import { normalizeUsername } from '../auth/username.js'
import { authenticateRequest } from '../auth/middleware.js'
import { clearLoginFailures, checkLoginRate, recordLoginFailure, recordSourceAttempt } from '../auth/rateLimit.js'
import { clearSessionCookie, createSession, findSession, revokeAllSessions, revokeSession, setSessionCookie } from '../auth/session.js'
import { isExpiredCsrf, issueCsrf, revokeCsrfSession, validateCsrf } from '../auth/csrf.js'

export const authRouter = Router()

const fail = (res: any, secure: boolean) => {
  issueCsrf(res, null, secure)
  return res.status(401).json({ message: '用户名或密码错误' })
}
const sourceOf = (req: any) => req.ip || 'local'
const secureCookie = () => process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE === 'true'

authRouter.get('/csrf', (req, res) => res.json({ token: issueCsrf(res, null, secureCookie()) }))
authRouter.post('/csrf/session', authenticateRequest, (req, res) => {
  const origin = req.get('origin')
  const allowed = req.app.locals.allowedOrigins as Set<string>
  if (!origin || origin === 'null' || !allowed.has(origin)) return res.status(403).json({ message: '请求校验失败' })
  res.set('Cache-Control', 'no-store')
  return res.json({ token: issueCsrf(res, res.locals.auth.sessionId, secureCookie()) })
})

authRouter.post('/login', async (req, res) => {
  try {
    const source = sourceOf(req)
    recordSourceAttempt(source)
    if (checkLoginRate('', source)) return res.set('Retry-After', '60').status(429).json({ message: '登录尝试过于频繁', retryAfter: 60 })
    if (!validateCsrf(req, null, false)) return res.status(403).json({ message: '请求校验失败' })
    const username = normalizeUsername(String(req.body?.username ?? ''))
    const password = String(req.body?.password ?? '')
    if (checkLoginRate(username, source)) return res.set('Retry-After', '900').status(429).json({ message: '登录尝试过于频繁', retryAfter: 900 })
    const result = await pool.query<{ id: string; username: string; password_hash: string; is_active: boolean }>('SELECT id, username, password_hash, is_active FROM users WHERE username = $1', [username])
    const user = result.rows[0]
    if (!user || !user.is_active || !(await verifyPassword(user.password_hash, password))) {
      recordLoginFailure(username, sourceOf(req))
      return fail(res, secureCookie())
    }
    if (!validateCsrf(req, null, true)) return res.status(403).json({ message: '请求校验失败' })
    clearLoginFailures(username)
    const session = await createSession(user.id, secureCookie())
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id])
    setSessionCookie(res, session.token, secureCookie())
    res.json({ user: { id: user.id, username: user.username }, csrfToken: issueCsrf(res, session.id, secureCookie()) })
  } catch {
    return fail(res, secureCookie())
  }
})

authRouter.post('/logout', authenticateRequest, async (req, res) => {
  if (!validateCsrf(req, res.locals.auth.sessionId)) return res.status(403).json(isExpiredCsrf(req, res.locals.auth.sessionId) ? { message: '安全令牌已过期', code: 'CSRF_EXPIRED' } : { message: '请求校验失败' })
  const sessionToken = req.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith('cancerapp_session='))?.slice('cancerapp_session='.length)
  if (sessionToken) await revokeSession(decodeURIComponent(sessionToken))
  revokeCsrfSession(res.locals.auth.sessionId)
  clearSessionCookie(res, secureCookie())
  res.status(204).end()
})

authRouter.get('/me', authenticateRequest, (_req, res) => res.json({ user: res.locals.auth }))

authRouter.post('/password', authenticateRequest, async (req, res) => {
  if (!validateCsrf(req, res.locals.auth.sessionId)) return res.status(403).json({ message: '请求校验失败' })
  const current = String(req.body?.currentPassword ?? '')
  const next = String(req.body?.newPassword ?? '')
  const result = await pool.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [res.locals.auth.id])
  if (!result.rows[0] || !(await verifyPassword(result.rows[0].password_hash, current))) return res.status(401).json({ message: '密码错误' })
  if (next.length < 12) return res.status(400).json({ message: '新密码长度不足' })
  const passwordHash = await hashPassword(next)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('UPDATE users SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW() WHERE id = $2', [passwordHash, res.locals.auth.id])
    await client.query('UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [res.locals.auth.id])
    await client.query('COMMIT')
  } catch {
    await client.query('ROLLBACK').catch(() => undefined)
    return res.status(500).json({ message: '密码修改失败' })
  } finally { client.release() }
  revokeCsrfSession(res.locals.auth.sessionId)
  clearSessionCookie(res, secureCookie())
  res.status(204).end()
})

authRouter.patch('/users/:userId/status', authenticateRequest, async (req, res) => {
  if (res.locals.auth.role !== 'admin') return res.status(403).json({ message: '权限不足' })
  if (!validateCsrf(req, res.locals.auth.sessionId)) return res.status(403).json({ message: '请求校验失败' })
  const target = req.params.userId
  const value: unknown = req.body?.isActive
  if (value !== true && value !== false && value !== 'true' && value !== 'false') return res.status(400).json({ message: '账户状态无效' })
  const active = value === true || value === 'true'
  if (target === res.locals.auth.id && !active) return res.status(400).json({ message: '管理员不能禁用自己' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const row = await client.query<{ role: string; is_active: boolean }>('SELECT role, is_active FROM users WHERE id = $1 FOR UPDATE', [target])
    if (!row.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ message: '用户不存在' }) }
    if (!active && row.rows[0].role === 'admin' && row.rows[0].is_active) {
      const admins = await client.query<{ id: string }>(`SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE FOR UPDATE`)
      if (admins.rowCount !== null && admins.rowCount <= 1) { await client.query('ROLLBACK'); return res.status(400).json({ message: '不能禁用最后一个管理员' }) }
    }
    await client.query('UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2', [active, target])
    let revokedTargetCsrf = false
    if (!active) {
      await client.query('UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [target])
      revokedTargetCsrf = true
    }
    await client.query('COMMIT')
    if (revokedTargetCsrf) revokeCsrfSession(target)
    res.status(204).end()
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    res.status(500).json({ message: '账户状态更新失败' })
  } finally { client.release() }
})
