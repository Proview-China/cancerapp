import type { ChatMessage as UIMessage } from '../types/chat'

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:4000'

export type ChatStreamOptions = {
  caseId?: string | null
  model?: string
  temperature?: number
  contextText?: string | null
  onChunk: (text: string) => void
}

type ChatPayloadMessage = { role: 'user' | 'assistant' | 'system'; content: string }

const mapMessages = (messages: UIMessage[]): ChatPayloadMessage[] =>
  messages.map((m) => ({
    role: m.role === 'assistant' || m.role === 'system' ? m.role : 'user',
    content: m.text,
  }))

export const streamChat = async (
  messages: UIMessage[],
  { caseId, model, temperature, contextText, onChunk }: ChatStreamOptions,
) => {
  const payloadMessages = mapMessages(messages)
  if (contextText && contextText.trim()) {
    payloadMessages.unshift({
      role: 'system',
      content: `病例上下文（前四份文字病例摘要）：\n${contextText.trim()}`,
    })
  }

  const res = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: payloadMessages,
      caseId,
      model,
      temperature,
      stream: true,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || '调用 AI 接口失败')
  }

  if (!res.body) {
    throw new Error('AI 响应为空')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const payload = trimmed.replace(/^data:\s*/, '')
      if (payload === '[DONE]') {
        return
      }
      try {
        const parsed = JSON.parse(payload)
        const delta: string =
          parsed?.choices?.[0]?.delta?.content ??
          parsed?.choices?.[0]?.message?.content ??
          parsed?.content ??
          ''
        if (delta) {
          onChunk(delta)
        }
      } catch {
        // 忽略无法解析的片段
      }
    }
  }
}

export type AIConfig = {
  baseUrl: string
  model: string
  hasApiKey: boolean
  temperature: number
}

export const fetchAIConfig = async (): Promise<AIConfig> => {
  const res = await fetch(`${API_BASE}/ai/config`)
  if (!res.ok) {
    throw new Error('获取 AI 配置失败')
  }
  return res.json()
}

export const saveAIConfig = async (payload: { baseUrl?: string; apiKey?: string; model?: string; temperature?: number }) => {
  const res = await fetch(`${API_BASE}/ai/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error('保存 AI 配置失败')
  }
  return res.json() as Promise<AIConfig & { hasApiKey: boolean }>
}
