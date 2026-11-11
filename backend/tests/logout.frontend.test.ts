import { beforeEach, describe, expect, it, vi } from 'vitest'

const reply = (status: number, body: object = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
const fetchMock = vi.fn()
beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } })
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

describe('退出流程', () => {
  async function signedIn() {
    fetchMock.mockResolvedValueOnce(reply(200, { token: 'initial' })).mockResolvedValueOnce(reply(200, { user: {}, csrfToken: 'old' }))
    const auth = await import('../../frontend/src/services/authService')
    await auth.login('a', 'b')
    fetchMock.mockClear()
    return auth
  }
  it('即使存在旧内存 token，也先获取会话绑定 token，再退出', async () => {
    const auth = await signedIn()
    fetchMock.mockResolvedValueOnce(reply(200, { token: 'new' })).mockResolvedValueOnce(reply(204))
    await auth.logout()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toContain('/auth/csrf/session')
    expect(fetchMock.mock.calls[1][1].headers['X-CSRF-Token']).toBe('new')
  })
  it('会话失效时清空前端 token 并返回 401', async () => {
    const auth = await signedIn()
    fetchMock.mockResolvedValueOnce(reply(401, { message: '未登录' }))
    await expect(auth.logout()).rejects.toMatchObject({ status: 401 })
    fetchMock.mockResolvedValueOnce(reply(200, { token: 'new' })).mockResolvedValueOnce(reply(204))
    await auth.logout()
    expect(fetchMock.mock.calls[2][1].headers['X-CSRF-Token']).toBe('new')
  })
  it('无旧 Cookie 和内存 token 时也成功', async () => {
    const auth = await signedIn()
    fetchMock.mockResolvedValueOnce(reply(200, { token: 'new' })).mockResolvedValueOnce(reply(204))
    await auth.logout()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][1].headers['X-CSRF-Token']).toBe('new')
  })
  it.each(['403', 'network'])('获取 token 的 %s 错误不伪装成功', async (kind) => {
    const auth = await signedIn()
    if (kind === '403') fetchMock.mockResolvedValueOnce(reply(403, { message: '拒绝' }))
    else fetchMock.mockRejectedValueOnce(new Error('网络错误'))
    await expect(auth.logout()).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('正常退出只请求一次', async () => {
    const auth = await signedIn()
    fetchMock.mockResolvedValueOnce(reply(200, { token: 'new' })).mockResolvedValueOnce(reply(204))
    await auth.logout()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
