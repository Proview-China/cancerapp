import { View, Text } from '@tarojs/components'
import classNames from 'classnames'
import './ChatBubble.scss'

type ChatBubbleProps = {
  content: string
  role: 'user' | 'assistant'
}

export function ChatBubble({ content, role }: ChatBubbleProps) {
  return (
    <View className={classNames('chat-bubble', `chat-bubble--${role}`)}>
      <Text>{content}</Text>
    </View>
  )
}
