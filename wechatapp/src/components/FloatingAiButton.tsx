import { View, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import './FloatingAiButton.scss'

type FloatingAiButtonProps = {
  label?: string
  onClick: () => void
}

export function FloatingAiButton({ label = 'AI', onClick }: FloatingAiButtonProps) {
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const handler = (res: { height: number }) => {
      setKeyboardHeight(res?.height || 0)
    }
    // @ts-ignore
    Taro.onKeyboardHeightChange?.(handler)
    return () => {
      // @ts-ignore
      Taro.offKeyboardHeightChange?.(handler)
    }
  }, [])

  const dynamicBottom =
    keyboardHeight > 0
      ? `calc(${keyboardHeight + 20}px + env(safe-area-inset-bottom))`
      : `calc(32px + env(safe-area-inset-bottom))`

  return (
    <View className='floating-ai-button' style={{ bottom: dynamicBottom }} onClick={onClick}>
      <Text>{label}</Text>
    </View>
  )
}
