import { View, Text } from '@tarojs/components'
import './FloatingAiButton.scss'

type FloatingAiButtonProps = {
  label?: string
  onClick: () => void
}

export function FloatingAiButton({ label = 'AI', onClick }: FloatingAiButtonProps) {
  return (
    <View className='floating-ai-button' onClick={onClick}>
      <Text>{label}</Text>
    </View>
  )
}
