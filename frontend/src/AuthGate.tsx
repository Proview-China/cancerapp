import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { AuthError, currentUser, login, logout } from './services/authService'

export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'anonymous' | 'authenticated' | 'error'>('checking')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const unauthorized = () => setState('anonymous')
    const forbidden = () => setMessage('当前账户无权执行此操作')
    window.addEventListener('cancerapp:unauthorized', unauthorized)
    window.addEventListener('cancerapp:forbidden', forbidden)
    return () => {
      window.removeEventListener('cancerapp:unauthorized', unauthorized)
      window.removeEventListener('cancerapp:forbidden', forbidden)
    }
  }, [])

  const check = () => {
    setState('checking')
    currentUser().then(user => setState(user ? 'authenticated' : 'anonymous'))
      .catch(() => setState('error'))
  }
  useEffect(() => { check() }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      await login(username, password)
      setPassword('')
      setState('authenticated')
    } catch (error) {
      setPassword('')
      setMessage(error instanceof Error ? error.message : '登录失败')
    } finally { setBusy(false) }
  }

  if (state === 'checking') return <main>正在确认登录状态…</main>
  if (state === 'error') return <main role="alert">无法连接认证服务。<button onClick={check}>重试</button></main>
  if (state === 'anonymous') return <main style={{ padding: 32 }}>
    <form onSubmit={submit}>
      <h1>登录</h1>
      <label>用户名 <input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required /></label>
      <label>密码 <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
      <button disabled={busy} type="submit">登录</button>
      {message && <p role="alert">{message}</p>}
    </form>
  </main>
  return <>
    <button style={{ position: 'fixed', right: 150, top: 8, width: 'auto', height: 36, zIndex: 9999 }} disabled={busy} onClick={async () => {
      setBusy(true)
      try { await logout(); setState('anonymous'); setMessage('') }
      catch (error) {
        if (error instanceof AuthError && error.status === 401) { setState('anonymous'); setMessage('') }
        else setMessage(error instanceof Error ? error.message : '退出失败，请重试')
      }
      finally { setBusy(false) }
    }}>退出登录</button>
    {message && <div role="alert" style={{ position: 'fixed', right: 150, top: 40, zIndex: 9999 }}>{message}</div>}
    {children}
  </>
}
