import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './AIChatPanel.css'

type ChatRole = 'user' | 'assistant'

type Attachment = {
  id: string
  name: string
  size: number
}

type ChatMessage = {
  id: string
  role: ChatRole
  text: string
  attachments?: Attachment[]
}

export type AIChatHandle = {
  newChat: () => void
  focusInput: () => void
}

type Props = {
  caseId: string | null
}

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export const AIChatPanel = forwardRef<AIChatHandle, Props>(({ caseId }, ref) => {
  const storageRef = useRef<Map<string, ChatMessage[]>>(new Map())
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const DEFAULT_MD_URL = `${import.meta.env.BASE_URL ?? '/'}demo_fake/fake%20ai.txt`

  const syncFromStorage = useCallback(() => {
    const key = caseId ?? '__no_case__'
    setMessages(storageRef.current.get(key) ?? [])
  }, [caseId])

  const saveToStorage = useCallback(
    (next: ChatMessage[]) => {
      const key = caseId ?? '__no_case__'
      storageRef.current.set(key, next)
      setMessages(next)
    },
    [caseId],
  )

  useEffect(() => {
    syncFromStorage()
  }, [syncFromStorage])

  // 聊天区域滚动禁用：不自动滚动，不设置 scrollTop

  const focusInput = () => {
    inputRef.current?.focus()
  }

  const seedDefaultAssistant = useCallback(async () => {
    const key = caseId ?? '__no_case__'
    const existing = storageRef.current.get(key) ?? []
    if (existing.length > 0) return

    let md = ''
    try {
      const res = await fetch(DEFAULT_MD_URL)
      if (res.ok) md = await res.text()
      else throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      md = `无法读取 demo_fake/fake ai.txt\n\n> 错误: ${(err as Error).message}`
    }

    const reply: ChatMessage = { id: createId(), role: 'assistant', text: md }
    const next = [...existing, reply]
    storageRef.current.set(key, next)
    setMessages(next)
  }, [caseId, DEFAULT_MD_URL])

  useImperativeHandle(
    ref,
    () => ({
      newChat: () => {
        saveToStorage([])
        setText('')
        setPendingFiles([])
        setPreviewUrls([])
        seedDefaultAssistant()
        focusInput()
      },
      focusInput,
    }),
    [saveToStorage, seedDefaultAssistant],
  )

  const handlePickFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return
    setPendingFiles((prev) => [...prev, ...Array.from(files)])
  }, [])

  const attachments = useMemo<Attachment[]>(
    () => pendingFiles.map((f) => ({ id: createId(), name: f.name, size: f.size })),
    [pendingFiles],
  )

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed && attachments.length === 0) return
    const userMsg: ChatMessage = {
      id: createId(),
      role: 'user',
      text: trimmed,
      attachments,
    }
    const next = [...messages, userMsg]
    saveToStorage(next)
    setText('')
    setPendingFiles([])
    setPreviewUrls([])
  }, [attachments, messages, saveToStorage, text])

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index))
  }, [])

  useEffect(() => {
    const urls = pendingFiles.map((f) => (f.type && f.type.startsWith('image/') ? URL.createObjectURL(f) : ''))
    setPreviewUrls((prev) => {
      prev.forEach((u) => {
        if (u) URL.revokeObjectURL(u)
      })
      return urls
    })
    return () => {
      urls.forEach((u) => {
        if (u) URL.revokeObjectURL(u)
      })
    }
  }, [pendingFiles])

  // 初次渲染或切换病例时，如果该会话为空，则在首次回复前输出默认 Markdown
  useEffect(() => {
    if (messages.length === 0) {
      seedDefaultAssistant()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, messages.length])

  return (
    <div className="ai-chat" role="region" aria-label="AI 对话">
      <div className="ai-chat__messages" ref={listRef}>
        {messages.map((m) => (
          <div key={m.id} className={["ai-bubble", `ai-bubble--${m.role}`].join(' ')}>
            <div className="ai-markdown">
              {m.role === 'assistant' ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
              ) : (
                <>{m.text || '（空消息）'}</>
              )}
            </div>
            {m.attachments && m.attachments.length > 0 ? (
              <div className="ai-bubble__attachments">
                {m.attachments.map((a) => (
                  <span key={a.id} className="ai-chip" title={`${a.name} • ${a.size}B`}>
                    {a.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="ai-chat__composer">
        {pendingFiles.length > 0 ? (
          <div className="ai-pending">
            {pendingFiles.map((file, idx) => (
              <div key={`${file.name}-${idx}`} className="ai-pending__item">
                {file.type && file.type.startsWith('image/') && previewUrls[idx] ? (
                  <img className="ai-pending__thumb" src={previewUrls[idx]} alt={file.name} />
                ) : (
                  <div className="ai-pending__file" title={file.name}>{file.name}</div>
                )}
                <span className="ai-pending__clip" aria-hidden>📎</span>
                <button
                  type="button"
                  className="ai-pending__remove"
                  aria-label="移除附件"
                  title="移除附件"
                  onClick={() => removePendingFile(idx)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="ai-composer__shell">
          <button
            type="button"
            className="ai-add-btn"
            aria-label="添加附件"
            title="添加附件"
            onClick={() => fileRef.current?.click()}
          >
            ＋
          </button>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="请输入你想询问的问题"
            className="ai-chat__input"
            aria-label="输入消息"
          />
        </div>
        <input ref={fileRef} type="file" multiple onChange={(e) => handlePickFiles(e.target.files)} style={{ display: 'none' }} />
        <button
          type="button"
          className="ai-send-btn"
          onClick={handleSend}
          aria-label="发送"
          title="发送"
        >
          ➤
        </button>
      </div>
    </div>
  )
})

AIChatPanel.displayName = 'AIChatPanel'
