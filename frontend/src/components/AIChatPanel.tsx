import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './AIChatPanel.css'
import type { ChatMessage } from '../types/chat'
import { fetchAIConfig, streamChat, type AIConfig } from '../services/aiService'

type Attachment = { id: string; name: string; size: number }

export type AIChatHandle = {
  newChat: () => void
  focusInput: () => void
}

type Props = {
  caseId: string | null
  contextText?: string | null
}

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export const AIChatPanel = forwardRef<AIChatHandle, Props>(({ caseId, contextText }, ref) => {
  const storageRef = useRef<Map<string, ChatMessage[]>>(new Map())
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiConfig, setAIConfig] = useState<AIConfig | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const ensureGreeting = useCallback(() => {
    const key = caseId ?? '__no_case__'
    const existing = storageRef.current.get(key) ?? []
    if (existing.length > 0) return
    const hello: ChatMessage = {
      id: createId(),
      role: 'assistant',
      text: '你好，我是智能病理助手，可以帮你解读病例和影像，有问题随时问我。',
    }
    storageRef.current.set(key, [hello])
    setMessages([hello])
  }, [caseId])

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
    ensureGreeting()
  }, [ensureGreeting, syncFromStorage])

  useEffect(() => {
    fetchAIConfig()
      .then(setAIConfig)
      .catch(() => setAIConfig(null))
  }, [])

  // 聊天区域滚动：收到新内容时自动滚动到底
  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  const focusInput = () => {
    inputRef.current?.focus()
  }

  useImperativeHandle(
    ref,
    () => ({
      newChat: () => {
        saveToStorage([])
        setText('')
        setPendingFiles([])
        setPreviewUrls([])
        ensureGreeting()
        focusInput()
      },
      focusInput,
    }),
    [ensureGreeting, saveToStorage],
  )

  const handlePickFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return
    setPendingFiles((prev) => [...prev, ...Array.from(files)])
  }, [])

  const attachments = useMemo<Attachment[]>(
    () => pendingFiles.map((f) => ({ id: createId(), name: f.name, size: f.size })),
    [pendingFiles],
  )

  const handleSend = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed && attachments.length === 0) return
    if (!aiConfig?.hasApiKey) {
      setError('未配置 DeepSeek API Key，请在“设置-后台行为”填写。')
      return
    }

    setError(null)
    const userMsg: ChatMessage = {
      id: createId(),
      role: 'user',
      text: trimmed,
      attachments,
    }
    const assistantId = createId()
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', text: '' }
    const history = [...messages, userMsg, assistantMsg]
    saveToStorage(history)
    setText('')
    setPendingFiles([])
    setPreviewUrls([])
    setIsStreaming(true)

    try {
      await streamChat(history.filter((m) => m.role !== 'system'), {
        caseId: caseId ?? undefined,
        model: aiConfig.model,
        contextText: contextText ?? null,
        onChunk: (chunk) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + chunk } : m)),
          )
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '调用 AI 失败'
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, text: `⚠️ ${message}` } : m)),
      )
      setError(message)
    } finally {
      setIsStreaming(false)
    }
  }, [attachments, messages, saveToStorage, text, aiConfig, caseId, contextText])

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

  return (
    <div className="ai-chat" role="region" aria-label="AI 对话">
      {!aiConfig?.hasApiKey ? (
        <div className="ai-chat__config-hint" role="alert">
          未配置 DeepSeek API Key，无法调用真实回答。请前往“设置 &gt; 后台行为”填写。
        </div>
      ) : null}
      {error ? (
        <div className="ai-chat__config-hint" role="alert">
          {error}
        </div>
      ) : null}
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
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <button
          type="button"
          className="ai-send-btn"
          onClick={handleSend}
          aria-label="发送"
          title="发送"
          disabled={isStreaming || !aiConfig?.hasApiKey}
        >
          ➤
        </button>
        </div>
        <input ref={fileRef} type="file" multiple onChange={(e) => handlePickFiles(e.target.files)} style={{ display: 'none' }} />
      </div>
    </div>
  )
})

AIChatPanel.displayName = 'AIChatPanel'
