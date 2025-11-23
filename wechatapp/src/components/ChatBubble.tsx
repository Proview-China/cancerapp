import { View, Text } from '@tarojs/components'
import classNames from 'classnames'
import './ChatBubble.scss'

type ChatBubbleProps = {
  content: string
  role: 'user' | 'assistant'
  timestamp?: number
}

const roleLabel: Record<'user' | 'assistant', string> = {
  user: '我',
  assistant: '助手'
}

const formatTime = (timestamp?: number) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const pad = (num: number) => num.toString().padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function ChatBubble({ content, role, timestamp }: ChatBubbleProps) {
  const timeText = formatTime(timestamp)

  return (
    <View className={classNames('chat-bubble', `chat-bubble--${role}`)}>
      <View className='chat-bubble__meta'>
        <Text className='chat-bubble__role'>{roleLabel[role]}</Text>
        {timeText && <Text className='chat-bubble__time'>{timeText}</Text>}
      </View>
      <Text className='chat-bubble__content'>{content}</Text>
    </View>
  )
}
