import { View, ScrollView, Textarea, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { ContextBanner } from '../../components/ContextBanner'
import { ChatBubble } from '../../components/ChatBubble'
import './index.scss'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
}

function AiChatPage() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'assistant-intro',
      role: 'assistant',
      content: '这里是 CancerApp AI 助手，我可以解读分析指标并提供建议。',
      timestamp: Date.now()
    }
  ])
  const [keyboardOffset, setKeyboardOffset] = useState(0)

  const contextMode = router.params.contextMode ?? 'global'
  const caseIdentifier = router.params.caseIdentifier
  const reportSummary = router.params.reportSummary

  const handleBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack()
      return
    }
    Taro.switchTab({ url: '/pages/index/index' })
  }

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

  const shortcuts = useMemo(
    () =>
      contextMode === 'case'
        ? ['解读当前病例的分析指标', '这份报告的重点是什么？', '给出随访建议与下步检查']
        : ['如何导入病例数据？', '支持哪些影像文件格式？', 'AI 能做什么？'],
    [contextMode]
  )

  const handleSend = (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text) return
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now()
    }
    const reply: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content:
        contextMode === 'case'
          ? '我已根据当前病例上下文记录问题，稍后会给到详细分析（示例回复）。'
          : '收到！当前为无上下文模式，可先说明想了解的指标（示例回复）。',
      timestamp: Date.now()
    }
    setMessages((prev) => [...prev, userMessage, reply])
    setInput('')
  }

  const handleShortcut = (text: string) => {
    setInput(text)
    handleSend(text)
  }

  const handleAttach = () => {
    Taro.showToast({ title: '附件上传为示例能力，当前为展示模式', icon: 'none', duration: 1400 })
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
            content: `已载入病例 ${caseIdentifier} 的 demo 数据，可就指标或预测提出问题。`,
            timestamp: Date.now()
          }
        ]
      })
    }
  }, [contextMode, caseIdentifier])

  useEffect(() => {
    const handler = (res: { height: number }) => {
      setKeyboardOffset(res?.height || 0)
    }
    // @ts-ignore
    Taro.onKeyboardHeightChange?.(handler)
    return () => {
      // @ts-ignore
      Taro.offKeyboardHeightChange?.(handler)
    }
  }, [])

  const inputPaddingBottom = keyboardOffset > 0 ? keyboardOffset + 12 : undefined

  return (
    <View className='page-ai-chat page-shell'>
      <View className='chat-top'>
        <View className='nav-back' onClick={handleBack}>
          <Text className='nav-back__icon'>←</Text>
        </View>
        <ContextBanner label={banner.label} description={banner.description} />
      </View>
      <View className='chat-shortcuts'>
        {shortcuts.map((item) => (
          <Text key={item} className='chat-shortcuts__pill' onClick={() => handleShortcut(item)}>
            {item}
          </Text>
        ))}
      </View>
      <ScrollView scrollY className='chat-view'>
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            role={message.role}
            content={message.content}
            timestamp={message.timestamp}
          />
        ))}
      </ScrollView>

      <View
        className='chat-input'
        style={inputPaddingBottom ? { paddingBottom: `${inputPaddingBottom}px` } : undefined}
      >
        <View className='chat-input__attach' onClick={handleAttach}>
          <Text>附件</Text>
        </View>
        <Textarea
          className='chat-input__textarea'
          value={input}
          placeholder='请输入你的问题…'
          maxlength={-1}
          autoHeight
          adjustPosition={false}
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
