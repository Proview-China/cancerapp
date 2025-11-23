import { View, Text } from '@tarojs/components'
import type { CaseReport, CaseSample, TissueAnalysis } from '../types/cases'
import { StateHint } from './StateHint'
import './AnalysisPanel.scss'

type AnalysisPanelProps = {
  caseIdentifier: string
  sample: CaseSample | null
  report: CaseReport | null
}

type MetricConfig<T> = {
  key: keyof T
  label: string
  unit?: string
  precision?: number
}

const rawMetrics: MetricConfig<TissueAnalysis['raw']>[] = [
  { key: 'pos_cells_1_weak', label: '1级弱阳性细胞数 / Positive Cells 1 Weak' },
  { key: 'pos_cells_2_moderate', label: '2级中度阳性细胞数 / Positive Cells 2 Moderate' },
  { key: 'pos_cells_3_strong', label: '3级强阳性细胞数 / Positive Cells 3 Strong' },
  { key: 'iod_total_cells', label: 'IOD 核总数 / Total Cells Number' },
  { key: 'positive_area_mm2', label: '阳性面积 / Positive Area', unit: 'mm²', precision: 4 },
  { key: 'tissue_area_mm2', label: '组织面积 / Tissue Area', unit: 'mm²', precision: 4 },
  { key: 'positive_area_px', label: '阳性像素面积 / Positive Area (px)', unit: 'px' },
  { key: 'tissue_area_px', label: '组织像素面积 / Tissue Area (px)', unit: 'px' },
  { key: 'positive_intensity', label: '阳性强度 / Positive Intensity', precision: 2 }
]

const derivedMetrics: MetricConfig<TissueAnalysis['derived']>[] = [
  { key: 'positive_cells_ratio', label: '阳性细胞比率 / Positive Cells', unit: '%' },
  { key: 'positive_cells_density', label: '阳性细胞密度 / Positive Cells Density', unit: 'number/mm²' },
  { key: 'mean_density', label: '平均光密度值 / Mean Density', precision: 3 },
  { key: 'h_score', label: 'H-Score' },
  { key: 'irs', label: 'IRS' }
]

const formatNumber = (value: number | null | undefined, precision = 2) => {
  if (value === null || value === undefined) return '--'
  if (Number.isNaN(value)) return '--'
  return Number(value).toFixed(precision)
}

export function AnalysisPanel({ caseIdentifier, sample, report }: AnalysisPanelProps) {
  const analysis = sample?.analysis ?? null
  const source =
    (analysis?.metadata?.source as string) ||
    (analysis ? 'demo' : '无分析数据')

  const sampleLabel =
    sample?.displayName ?? sample?.originalFilename ?? sample?.id ?? '未选择样本'

  return (
    <View className='analysis-panel'>
      <View className='analysis-panel__section card-surface'>
        <Text className='analysis-panel__section-title'>基本信息</Text>
        <View className='analysis-panel__grid analysis-panel__grid--2'>
          <View className='analysis-panel__info'>
            <Text className='analysis-panel__label'>病例 / 样本</Text>
            <Text className='analysis-panel__value'>
              {caseIdentifier} / {sampleLabel}
            </Text>
          </View>
          <View className='analysis-panel__info'>
            <Text className='analysis-panel__label'>分析来源</Text>
            <Text className='analysis-panel__value'>{source}</Text>
          </View>
        </View>
      </View>

      <View className='analysis-panel__section card-surface'>
        <Text className='analysis-panel__section-title'>基础病理数据</Text>
        <View className='analysis-panel__grid analysis-panel__grid--2'>
          {rawMetrics.map((metric) => (
            <View className='analysis-panel__metric-card' key={metric.key as string}>
              <Text className='analysis-panel__metric-label'>{metric.label}</Text>
              <Text className='analysis-panel__metric-value'>
                {formatNumber(analysis?.raw?.[metric.key], metric.precision ?? 2)}
                {analysis?.raw?.[metric.key] !== null && analysis?.raw?.[metric.key] !== undefined && metric.unit
                  ? ` ${metric.unit}`
                  : ''}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View className='analysis-panel__section card-surface'>
        <View className='analysis-panel__section-head'>
          <Text className='analysis-panel__section-title'>分析数据</Text>
          <Text className='analysis-panel__section-sub'>预测 & 建议</Text>
        </View>
        <View className='analysis-panel__grid analysis-panel__grid--2'>
          {derivedMetrics.map((metric) => (
            <View className='analysis-panel__metric-card' key={metric.key as string}>
              <Text className='analysis-panel__metric-label'>{metric.label}</Text>
              <Text className='analysis-panel__metric-value'>
                {formatNumber(analysis?.derived?.[metric.key], metric.precision ?? 2)}
                {analysis?.derived?.[metric.key] !== null &&
                analysis?.derived?.[metric.key] !== undefined &&
                metric.unit
                  ? ` ${metric.unit}`
                  : ''}
              </Text>
            </View>
          ))}
        </View>

        {report ? (
          <View className='analysis-panel__prediction card-surface'>
            <Text className='analysis-panel__prediction-title'>{report.title}</Text>
            {report.summary && (
              <Text className='analysis-panel__prediction-subtitle'>{report.summary}</Text>
            )}
            {report.content
              .split(/\n{2,}/g)
              .map((block, index) => block.replace(/[#*`>-]/g, '').trim())
              .filter(Boolean)
              .map((block, index) => (
                <Text key={index} className='analysis-panel__prediction-body'>
                  {block}
                </Text>
              ))}
          </View>
        ) : (
          <StateHint status='empty' message='暂无预测建议' />
        )}
      </View>

      {!analysis && (
        <View className='analysis-panel__fallback'>
          <StateHint status='empty' message='该病例暂无分析数据' />
        </View>
      )}
    </View>
  )
}
