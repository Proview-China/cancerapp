import { View, Text } from '@tarojs/components'
import type { TissueAnalysis } from '../types/cases'
import './AnalysisMetrics.scss'

type AnalysisMetricsProps = {
  analysis: TissueAnalysis
}

const derivedOrder: Array<{ key: keyof TissueAnalysis['derived']; label: string; unit?: string }> = [
  { key: 'positive_cells_ratio', label: '阳性细胞比率', unit: '%' },
  { key: 'positive_cells_density', label: '阳性细胞密度', unit: 'number/mm²' },
  { key: 'mean_density', label: '平均光密度' },
  { key: 'h_score', label: 'H-Score' },
  { key: 'irs', label: 'IRS' }
]

export function AnalysisMetrics({ analysis }: AnalysisMetricsProps) {
  return (
    <View className='analysis-metrics'>
      {derivedOrder.map((item) => (
        <View className='analysis-metrics__cell' key={item.key}>
          <Text className='analysis-metrics__label'>{item.label}</Text>
          <Text className='analysis-metrics__value'>
            {analysis.derived[item.key] ?? '--'}
            {analysis.derived[item.key] !== null && item.unit ? ` ${item.unit}` : ''}
          </Text>
        </View>
      ))}
    </View>
  )
}
