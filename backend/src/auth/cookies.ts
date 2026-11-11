import type { Request, Response } from 'express'

export const parseCookies = (req: Request) => {
  const raw = req.headers.cookie ?? ''
  return Object.fromEntries(raw.split(';').filter(Boolean).map((part) => {
    const index = part.indexOf('=')
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]
  }))
}

export const appendCookie = (res: Response, name: string, value: string, options: { httpOnly: boolean; maxAge: number; secure: boolean }) => {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax', `Max-Age=${Math.floor(options.maxAge / 1000)}`]
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.secure) parts.push('Secure')
  const previous = res.getHeader('Set-Cookie')
  const cookies = Array.isArray(previous) ? previous : previous ? [String(previous)] : []
  res.setHeader('Set-Cookie', [...cookies, parts.join('; ')])
}

export const clearCookie = (res: Response, name: string, secure: boolean) => appendCookie(res, name, '', { httpOnly: name === 'cancerapp_session', maxAge: 0, secure })
