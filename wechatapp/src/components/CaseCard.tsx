import { View, Text } from '@tarojs/components'
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
    <View className='case-card'>
      <View className='case-card__header'>
        <View>
          <Text className='case-card__title'>{record.identifier}</Text>
          {record.displayName && <Text className='case-card__subtitle'>{record.displayName}</Text>}
        </View>
        <View className='case-card__actions'>
          <Text className='case-card__action' onClick={onOpen}>
            查看
          </Text>
          <Text className='case-card__action' onClick={onToggle}>
            {expanded ? '收起' : '展开'}
          </Text>
        </View>
      </View>
      {expanded && (
        <View className='case-card__body'>
          <View className='case-card__section'>
            <Text className='case-card__section-title'>图像</Text>
            {record.samples.map((sample) => (
              <View key={sample.id} className='case-card__item'>
                <Text className='case-card__item-title'>{sample.displayName ?? sample.modality}</Text>
                <Text className='case-card__item-subtitle'>{sample.modality}</Text>
              </View>
            ))}
          </View>
          <View className='case-card__section'>
            <Text className='case-card__section-title'>文字</Text>
            {record.reports.map((report) => (
              <View key={report.id} className='case-card__item'>
                <Text className='case-card__item-title'>{report.title}</Text>
                {report.summary && (
                  <Text className='case-card__item-subtitle'>{report.summary}</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}
