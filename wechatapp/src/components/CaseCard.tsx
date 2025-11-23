import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import classNames from 'classnames'
import type { CaseRecord } from '../types/cases'
import './CaseCard.scss'

type CaseCardProps = {
  record: CaseRecord
  expanded: boolean
  onToggle: () => void
  onOpen: () => void
}

export function CaseCard({ record, expanded, onToggle, onOpen }: CaseCardProps) {
  return (
    <View
      className='case-card'
      onClick={(event) => {
        event.stopPropagation()
        onOpen()
      }}
    >
      <View className='case-card__header'>
        <View className='case-card__title-block'>
          <Text className='case-card__title'>{record.identifier}</Text>
          {record.displayName && <Text className='case-card__subtitle'>{record.displayName}</Text>}
        </View>
        <View className='case-card__actions'>
          <Text
            className='case-card__chevron'
            onClick={(event) => {
              event.stopPropagation()
              onToggle()
            }}
          >
            {expanded ? '▾' : '›'}
          </Text>
        </View>
      </View>

      {expanded && (
        <View className='case-card__body'>
          <View className='case-card__section'>
            <View className='case-card__section-head'>
              <Text className='case-card__section-title'>图像</Text>
            </View>

            {record.samples.length === 0 && (
              <Text className='case-card__empty'>暂无图像</Text>
            )}
            {record.samples.map((sample) => (
              <View key={sample.id} className='case-card__item'>
                <Image className='case-card__thumb' mode='aspectFit' src={sample.thumbnailUrl ?? sample.imageUrl} />
                <View className='case-card__item-text'>
                  <Text className='case-card__item-title'>{sample.displayName ?? sample.modality}</Text>
                  <Text className='case-card__item-subtitle'>{sample.modality}</Text>
                </View>
              </View>
            ))}
          </View>

          <View className='case-card__section'>
            <View className='case-card__section-head'>
              <Text className='case-card__section-title'>文字</Text>
            </View>

            {record.reports.length === 0 && (
              <Text className='case-card__empty'>暂无文字病历</Text>
            )}
            {record.reports.map((report) => (
              <View key={report.id} className='case-card__item'>
                <View className='case-card__item-text'>
                  <Text className='case-card__item-title'>{report.title}</Text>
                  {report.summary && (
                    <Text className='case-card__item-subtitle'>{report.summary}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}
