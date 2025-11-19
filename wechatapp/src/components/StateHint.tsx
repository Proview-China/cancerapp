import { View, Text } from '@tarojs/components'
import './StateHint.scss'

type StateHintProps = {
  status: 'loading' | 'empty' | 'error'
  message: string
}

export function StateHint({ status, message }: StateHintProps) {
  return (
    <View className={`state-hint state-hint--${status}`}>
      <Text>{message}</Text>
    </View>
  )
}
