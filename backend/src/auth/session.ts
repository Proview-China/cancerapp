import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { Response } from 'express'
import { pool } from '../db/pool.js'
import type { SessionContext } from './types.js'
import { appendCookie, clearCookie } from './cookies.js'
import type { PoolClient } from 'pg'

export const SESSION_COOKIE = 'cancerapp_session'
export const CSRF_COOKIE = 'cancerapp_csrf'
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000
export const SESSION_IDLE_MS = 2 * 60 * 60 * 1000

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export const setSessionCookie = (res: Response, token: string, secure = false) => {
  appendCookie(res, SESSION_COOKIE, token, { httpOnly: true, secure, maxAge: SESSION_MAX_AGE_MS })
}

export const clearSessionCookie = (res: Response, secure = false) => {
  clearCookie(res, SESSION_COOKIE, secure)
}

export const createSession = async (userId: string, secure = false, client: Pick<PoolClient, 'query'> = pool) => {
  const token = randomBytes(32).toString('base64url')
  const id = randomUUID()
  const now = new Date()
  await client.query(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, last_seen_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, userId, hashToken(token), new Date(now.getTime() + SESSION_MAX_AGE_MS), now],
  )
  return { id, token, secure }
}

export const revokeAllSessions = async (userId: string) => {
  await pool.query('UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId])
}

export const revokeSession = async (token: string) => {
  await pool.query('UPDATE sessions SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL', [hashToken(token)])
}

export const findSession = async (token: string): Promise<SessionContext | null> => {
  const result = await pool.query<{ id: string; username: string; role: SessionContext['role']; session_id: string; expires_at: Date; last_seen_at: Date | null }>(
    `SELECT s.id AS session_id, u.id, u.username, u.role, s.expires_at, s.last_seen_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND u.is_active = TRUE`,
    [hashToken(token)],
  )
  const row = result.rows[0]
  if (!row) return null
  const now = Date.now()
  if (new Date(row.expires_at).getTime() <= now || (row.last_seen_at && now - new Date(row.last_seen_at).getTime() > SESSION_IDLE_MS)) {
    await revokeSession(token)
    return null
  }
  await pool.query('UPDATE sessions SET last_seen_at = NOW() WHERE id = $1', [row.session_id])
  return { id: row.id, username: row.username, role: row.role, sessionId: row.session_id }
}
