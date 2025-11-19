import { View, ScrollView, Textarea, Text } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { ContextBanner } from '../../components/ContextBanner'
import { ChatBubble } from '../../components/ChatBubble'
import './index.scss'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function AiChatPage() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'assistant-intro',
      role: 'assistant',
      content: '这里是 CancerApp AI 助手，我可以解读分析指标并提供建议。'
    }
  ])

  const contextMode = router.params.contextMode ?? 'global'
  const caseIdentifier = router.params.caseIdentifier
  const reportSummary = router.params.reportSummary

  const banner = useMemo(() => {
    if (contextMode === 'case' && caseIdentifier) {
      return {
        label: `当前上下文：${caseIdentifier}`,
        description: reportSummary ? decodeURIComponent(reportSummary) : '已关联当前病例'
      }
    }
    return {
      label: '无上下文',
      description: '欢迎直接提问或返回病例库选择病例后再进入 AI 对话'
    }
  }, [contextMode, caseIdentifier, reportSummary])

  const handleSend = () => {
    if (!input.trim()) return
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim()
    }
    const reply: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content:
        contextMode === 'case'
          ? '我已根据当前病例上下文记录问题，稍后会给到详细分析（示例回复）。'
          : '收到！当前为无上下文模式，可先说明想了解的指标（示例回复）。'
    }
    setMessages((prev) => [...prev, userMessage, reply])
    setInput('')
  }

  useEffect(() => {
    if (contextMode === 'case' && caseIdentifier) {
      setMessages((prev) => {
        const hasContextMessage = prev.some((item) => item.id === 'assistant-context')
        if (hasContextMessage) {
          return prev
        }
        return [
          ...prev,
          {
            id: 'assistant-context',
            role: 'assistant',
            content: `已载入病例 ${caseIdentifier} 的 demo 数据，可就指标或预测提出问题。`
          }
        ]
      })
    }
  }, [contextMode, caseIdentifier])

  return (
    <View className='page-ai-chat'>
      <ContextBanner label={banner.label} description={banner.description} />
      <ScrollView scrollY className='chat-view'>
        {messages.map((message) => (
          <ChatBubble key={message.id} role={message.role} content={message.content} />
        ))}
      </ScrollView>

      <View className='chat-input'>
        <Textarea
          value={input}
          placeholder='请输入你的问题…'
          maxlength={-1}
          autoHeight
          onInput={(event) => setInput(event.detail.value)}
        />
        <View className='chat-input__send' onClick={handleSend}>
          <Text>发送</Text>
        </View>
      </View>
    </View>
  )
}

export default AiChatPage
