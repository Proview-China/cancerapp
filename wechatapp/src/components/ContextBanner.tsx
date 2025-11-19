import { View, Text } from '@tarojs/components'
import './ContextBanner.scss'

type ContextBannerProps = {
  label: string
  description?: string
}

export function ContextBanner({ label, description }: ContextBannerProps) {
  return (
    <View className='context-banner'>
      <Text className='context-banner__label'>{label}</Text>
      {description && <Text className='context-banner__description'>{description}</Text>}
    </View>
  )
}
