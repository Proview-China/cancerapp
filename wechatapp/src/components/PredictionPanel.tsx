import { View, Text } from '@tarojs/components'
import type { CaseReport } from '../types/cases'
import './PredictionPanel.scss'

type PredictionPanelProps = {
  report: CaseReport
}

const formatMarkdown = (content: string) => content.split(/\n{2,}/g)

export function PredictionPanel({ report }: PredictionPanelProps) {
  return (
    <View className='prediction-panel'>
      <Text className='prediction-panel__title'>{report.title}</Text>
      {report.summary && <Text className='prediction-panel__summary'>{report.summary}</Text>}
      {formatMarkdown(report.content).map((block, index) => (
        <Text key={index} className='prediction-panel__paragraph'>
          {block.replace(/[#*`>-]/g, '').trim()}
        </Text>
      ))}
    </View>
  )
}
