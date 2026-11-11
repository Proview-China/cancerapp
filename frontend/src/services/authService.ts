const API_BASE = (window.location.origin === 'http://127.0.0.1:4000' ? window.location.origin : (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000')).replace(/\/$/, '')

let csrfToken: string | null = null
export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

const csrfHeaders = (): Record<string, string> => csrfToken ? { 'X-CSRF-Token': csrfToken } : {}

export const bootstrapCsrf = async () => {
  const response = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' })
  if (!response.ok) throw new Error('获取安全令牌失败')
  const data = await response.json() as { token: string }
  csrfToken = data.token
  return csrfToken
}

export const login = async (username: string, password: string) => {
  if (!csrfToken) await bootstrapCsrf()
  const response = await fetch(`${API_BASE}/auth/login`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...csrfHeaders() }, body: JSON.stringify({ username, password }) })
  if (!response.ok) {
    csrfToken = null
    await bootstrapCsrf().catch(() => undefined)
    throw new Error((await response.json().catch(() => null))?.message ?? '登录失败')
  }
  const data = await response.json() as { user: unknown; csrfToken: string }
  csrfToken = data.csrfToken
  return data.user
}

export const logout = async () => {
  const bootstrap = await fetch(`${API_BASE}/auth/csrf/session`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  const bootstrapError = bootstrap.ok ? null : await bootstrap.json().catch(() => null)
  if (!bootstrap.ok) {
    if (bootstrap.status === 401) csrfToken = null
    throw new AuthError(bootstrapError?.message ?? '获取安全令牌失败', bootstrap.status)
  }
  csrfToken = ((await bootstrap.json()) as { token: string }).token

  const response = await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include', headers: csrfHeaders() })
  const error = response.ok ? null : await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401) csrfToken = null
    throw new AuthError(error?.message ?? '退出登录失败', response.status)
  }
  csrfToken = null
}

export const currentUser = async () => {
  const response = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' })
  if (response.status === 401) return null
  if (!response.ok) throw new Error('无法确认登录状态')
  return (await response.json() as { user: unknown }).user
}
