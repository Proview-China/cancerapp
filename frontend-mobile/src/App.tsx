import { useEffect, useState, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import HomePage from './pages/Home'
import CaseDetailPage from './pages/CaseDetail'
import { fetchCases } from './services/caseService'
import type { CaseRecord } from './types/cases'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }
type ChatAttachment = { id: string; name: string; size: number; url?: string }

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

const usePortrait = () => {
  const [isPortrait, setIsPortrait] = useState<boolean>(() => window.matchMedia('(orientation: portrait)').matches)

  useEffect(() => {
    const media = window.matchMedia('(orientation: portrait)')
    const handle = () => setIsPortrait(media.matches)
    media.addEventListener('change', handle)
    window.addEventListener('resize', handle)
    return () => {
      media.removeEventListener('change', handle)
      window.removeEventListener('resize', handle)
    }
  }, [])

  return isPortrait
}

const AIOverlay = ({
  open,
  onClose,
  messages,
  onSend,
  onAddFiles,
  pending,
  onRemove,
}: {
  open: boolean
  onClose: () => void
  messages: ChatMessage[]
  onSend: (text: string) => void
  onAddFiles: (files: FileList | null) => void
  pending: ChatAttachment[]
  onRemove: (index: number) => void
}) => {
  const [draft, setDraft] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!open) {
      setDraft('')
    }
  }, [open])

  if (!open) return null

  return (
    <div className="ai-overlay" role="dialog" aria-label="AI 对话">
      <div className="ai-header card-surface">
        <div>
          <strong>AI 助手</strong>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>上下文来自当前病例列表/详情</div>
        </div>
        <button className="btn-primary" onClick={onClose} aria-label="关闭 AI 面板">
          关闭
        </button>
      </div>
        <div className="ai-overlay__panel card-surface">
          <div className="ai-messages">
            {messages.length === 0 ? <div className="empty-hint">还没有对话，先问问 AI 吧</div> : null}
            {messages.map((msg, index) => (
              <div key={index} className={["ai-bubble", msg.role === 'user' ? 'me' : ''].join(' ').trim()}>
                {msg.role === 'assistant' ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            ))}
            {pending.length ? (
              <div className="ai-pending">
                {pending.map((file, idx) => (
                <div key={file.id} className="ai-pending__item">
                  <div className="ai-pending__file" title={file.name}>
                    {file.name} ({Math.round(file.size / 1024)}KB)
                  </div>
                  <button
                    type="button"
                    className="ai-pending__remove"
                    aria-label="移除附件"
                    onClick={() => onRemove(idx)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="ai-input ai-input--single">
          <button className="ai-add" type="button" onClick={() => fileRef.current?.click()} aria-label="添加附件">
            ＋
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            onChange={(e) => onAddFiles(e.target.files)}
            style={{ display: 'none' }}
          />
          <input
            className="ai-single-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="请输入你想询问的问题"
            aria-label="AI 输入"
          />
          <button
            className="ai-send-round"
            type="button"
            onClick={() => {
              const text = draft.trim()
              if (!text && pending.length === 0) return
              onSend(text)
              setDraft('')
            }}
            aria-label="发送"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [cases, setCases] = useState<CaseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const isPortrait = usePortrait()
  const navigate = useNavigate()

  const seedDemo = useCallback(async () => {
    if (messages.length > 0) return
    try {
      const res = await fetch(`${import.meta.env.BASE_URL ?? '/'}demo_fake/fake%20ai.txt`)
      const text = res.ok ? await res.text() : '无法加载 demo_fake/fake ai.txt'
      setMessages([{ role: 'assistant', content: text }])
    } catch (err) {
      setMessages([{ role: 'assistant', content: `无法加载 demo_fake/fake ai.txt: ${(err as Error).message}` }])
    }
  }, [messages.length])

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchCases()
        setCases(data)
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('加载失败')
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    seedDemo()
  }, [seedDemo])

  const handleSend = (text: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    const hasAttach = attachments.length > 0
    const reply = hasAttach ? '已收到附件，稍后分析...' : '已收到，正在根据病例信息思考...'
    setTimeout(() => {
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    }, 300)
    setAttachments([])
  }

  const handleAddFiles = (files: FileList | null) => {
    if (!files) return
    setAttachments((prev) => [
      ...prev,
      ...Array.from(files).map((file) => ({ id: createId(), name: file.name, size: file.size })),
    ])
  }

  const content = (
    <Routes>
      <Route
        path="/"
        element={<HomePage cases={cases} loading={loading} error={error} />}
      />
      <Route path="/case/:id" element={<CaseDetailPage cases={cases} loading={loading} onBack={() => navigate('/')} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )

  const showOrientationMask = !isPortrait

  return (
    <div className="app-shell">
      <div className="app-header app-header--with-action card-surface">
        <div className="brand-row">
          <img src="/logo.png" alt="CancerApp" className="brand-mark" />
          <div className="brand-text">
            <strong>CancerApp</strong>
            <span>临床智能工作台 · 移动竖屏</span>
          </div>
        </div>
        {isPortrait ? (
          <button className="ai-header-btn" type="button" onClick={() => setAiOpen(true)}>
            AI
          </button>
        ) : null}
      </div>
      <div className="main-panel card-surface" aria-live="polite">
        {showOrientationMask ? (
          <div className="orientation-mask" role="alert">
            <div>请在竖屏下使用移动版 CancerApp</div>
          </div>
        ) : null}
        {content}
      </div>
      <AIOverlay
        open={aiOpen}
        messages={messages}
        pending={attachments}
        onRemove={(index) => setAttachments((prev) => prev.filter((_, i) => i !== index))}
        onClose={() => setAiOpen(false)}
        onSend={handleSend}
        onAddFiles={handleAddFiles}
      />
    </div>
  )
}

export default App
