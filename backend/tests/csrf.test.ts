import { describe, expect, it } from 'vitest'
import { issueCsrf, validateCsrf } from '../src/auth/csrf.js'

const response = () => {
  const headers = new Map<string, unknown>()
  return {
    setHeader: (name: string, value: unknown) => headers.set(name, value),
    getHeader: (name: string) => headers.get(name),
    headers,
  } as any
}

const requestFor = (token: string, origin = 'http://localhost:5173') => ({
  headers: { cookie: `cancerapp_csrf=${encodeURIComponent(token)}` },
  get: (name: string) => name.toLowerCase() === 'origin' ? origin : name.toLowerCase() === 'x-csrf-token' ? token : undefined,
  app: { locals: { allowedOrigins: new Set(['http://localhost:5173']) } },
} as any)

describe('CSRF 生命周期', () => {
  it('按 HTTP/HTTPS 配置设置 Secure，并消费 token', () => {
    const httpResponse = response()
    const httpToken = issueCsrf(httpResponse, null, false)
    expect(String(httpResponse.headers.get('Set-Cookie'))).not.toContain('Secure')
    expect(validateCsrf(requestFor(httpToken), null, true)).toBe(true)
    expect(validateCsrf(requestFor(httpToken), null, true)).toBe(false)

    const httpsResponse = response()
    issueCsrf(httpsResponse, null, true)
    expect(String(httpsResponse.headers.get('Set-Cookie'))).toContain('Secure')
  })

  it('拒绝 null 和不可信 Origin', () => {
    const result = response()
    const token = issueCsrf(result)
    expect(validateCsrf(requestFor(token, 'null'), null, false)).toBe(false)
    expect(validateCsrf(requestFor(token, 'https://untrusted.example'), null, false)).toBe(false)
  })

  it('会话令牌支持连续操作并拒绝跨会话使用', () => {
    const token = issueCsrf(response(), 'session-a')
    expect(validateCsrf(requestFor(token), 'session-a')).toBe(true)
    expect(validateCsrf(requestFor(token), 'session-a')).toBe(true)
    expect(validateCsrf(requestFor(token), 'session-b')).toBe(false)
  })
})
