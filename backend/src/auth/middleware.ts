import type { NextFunction, Request, Response } from 'express'
import { findSession } from './session.js'
import { parseCookies } from './cookies.js'

export const authenticateRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = parseCookies(req).cancerapp_session
    if (!token) return res.status(401).json({ message: '未登录' })
    const context = await findSession(token)
    if (!context) return res.status(401).json({ message: '未登录' })
    res.locals.auth = context
    return next()
  } catch {
    return res.status(401).json({ message: '未登录' })
  }
}
