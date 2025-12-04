import express from 'express'
import { loadAIConfig, saveAIConfig, type AIProviderConfig } from '../ai/configStore.js'
import { config } from '../config.js'

type OpenAIMessage = { role: 'user' | 'assistant' | 'system'; content: string }

const sanitizeLogs = (payload: unknown) => {
  try {
    const json = JSON.stringify(payload)
    return json.length > 512 ? `${json.slice(0, 512)}...` : json
  } catch {
    return '[unserializable]'
  }
}

export const aiRouter = express.Router()

aiRouter.get('/config', async (_req, res) => {
  const cfg = await loadAIConfig()
  res.json({
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    hasApiKey: Boolean(cfg.apiKey),
    temperature: cfg.temperature,
  })
})

aiRouter.post('/config', async (req, res) => {
  const { baseUrl, apiKey, model, temperature } = req.body ?? {}
  const next = await saveAIConfig({
    baseUrl: typeof baseUrl === 'string' ? baseUrl : undefined,
    apiKey: typeof apiKey === 'string' ? apiKey : undefined,
    model: typeof model === 'string' ? model : undefined,
    temperature: typeof temperature === 'number' ? temperature : undefined,
  })
  res.json({
    baseUrl: next.baseUrl,
    model: next.model,
    hasApiKey: Boolean(next.apiKey),
    temperature: next.temperature,
  })
})

aiRouter.post('/chat', async (req, res) => {
  const { messages, stream = true, model, temperature, caseId } = req.body ?? {}
  const cfg = await loadAIConfig()
  if (!cfg.apiKey) {
    res.status(400).json({ message: '未配置 DeepSeek API Key，请在设置页填写。' })
    return
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ message: 'messages 不能为空' })
    return
  }

  const normalizedMessages: OpenAIMessage[] = messages
    .map((m: any) => {
      if (!m || typeof m.content !== 'string' || !m.role) return null
      const trimmed = m.content.slice(0, config.ai.maxContentLength)
      const role = m.role === 'assistant' || m.role === 'system' ? m.role : 'user'
      return { role, content: trimmed }
    })
    .filter(Boolean) as OpenAIMessage[]

  const payload = {
    model: typeof model === 'string' ? model : cfg.model,
    stream: Boolean(stream),
    temperature:
      typeof temperature === 'number' && Number.isFinite(temperature) ? temperature : cfg.temperature,
    messages: [
      {
        role: 'system',
        content: '你是肿瘤影像与病理助手，回答简洁中文，不输出用户隐私；如缺上下文请主动声明。',
      },
      ...normalizedMessages,
      ...(caseId
        ? [
            {
              role: 'system' as const,
              content: `当前病例ID: ${caseId}。请在回答中保持上下文一致，不暴露敏感信息。`,
            },
          ]
        : []),
    ],
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.ai.timeoutMs)

  try {
    const upstream = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '')
      res.status(502).json({ message: '调用 DeepSeek 失败', detail: text.slice(0, 300) })
      return
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      const reader = upstream.body.getReader()
      const encoder = new TextEncoder()
      const flush = () => {
        const anyRes = res as any
        if (typeof anyRes.flush === 'function') {
          anyRes.flush()
        }
      }

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        if (value) {
          res.write(value)
          flush()
        }
      }
      res.end()
      return
    }

    // 非流式直接透传 JSON
    const json = await upstream.json()
    res.json(json)
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? '调用 DeepSeek 超时'
        : error instanceof Error
          ? error.message
          : '调用 DeepSeek 失败'
    res.status(502).json({ message })
    console.error('AI chat error:', message, sanitizeLogs(payload))
  } finally {
    clearTimeout(timeout)
  }
})
