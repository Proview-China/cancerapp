import { createHash, randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import { CSRF_COOKIE } from './session.js'
import { appendCookie } from './cookies.js'

type CsrfState = { hash: string; sessionId: string | null; expiresAt: number; used: boolean }
const states = new Map<string, CsrfState>()
const TTL = 10 * 60 * 1000

const digest = (token: string) => createHash('sha256').update(token).digest('hex')

export const issueCsrf = (res: Response, sessionId: string | null = null, secure = false) => {
  const token = randomBytes(32).toString('base64url')
  states.set(digest(token), { hash: digest(token), sessionId, expiresAt: Date.now() + TTL, used: false })
  appendCookie(res, CSRF_COOKIE, token, { httpOnly: false, secure, maxAge: TTL })
  return token
}

export const revokeCsrfSession = (sessionId: string) => {
  for (const [key, state] of states) {
    if (state.sessionId === sessionId) states.delete(key)
  }
}

export const isExpiredCsrf = (req: Request, sessionId: string) => {
  const origin = req.get('origin')
  const allowed = req.app.locals.allowedOrigins as Set<string>
  if (!origin || origin === 'null' || !allowed.has(origin)) return false
  const header = req.get('x-csrf-token')
  const cookie = req.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${CSRF_COOKIE}=`))?.slice(CSRF_COOKIE.length + 1)
  if (!header || header !== cookie) return false
  const state = states.get(digest(header))
  return !!state && !state.used && state.sessionId === sessionId && state.expiresAt <= Date.now()
}

export const validateCsrf = (req: Request, sessionId: string | null, consume = sessionId === null) => {
  const origin = req.get('origin')
  const allowed = req.app.locals.allowedOrigins as Set<string>
  if (!origin || origin === 'null' || !allowed.has(origin)) return false
  const header = req.get('x-csrf-token')
  const cookie = req.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${CSRF_COOKIE}=`))?.slice(CSRF_COOKIE.length + 1)
  if (!header || !cookie || header !== cookie) return false
  const state = states.get(digest(header))
  if (!state || state.used || state.expiresAt <= Date.now()) return false
  if (state.sessionId !== sessionId) return false
  if (consume) state.used = true
  return true
}
