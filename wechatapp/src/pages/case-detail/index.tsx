import { View, Text } from '@tarojs/components'
import Taro, { useLoad, useRouter } from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { fetchCaseDetail } from '../../services/cases'
import type { CaseRecord } from '../../types/cases'
import { AnalysisMetrics } from '../../components/AnalysisMetrics'
import { PredictionPanel } from '../../components/PredictionPanel'
import { FloatingAiButton } from '../../components/FloatingAiButton'
import { StateHint } from '../../components/StateHint'
import './index.scss'

type TabKey = 'analysis' | 'prediction'

function CaseDetailPage() {
  const router = useRouter()
  const [caseId, setCaseId] = useState<string | null>(null)
  const [record, setRecord] = useState<CaseRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('analysis')

  useLoad(() => {
    setCaseId(router.params.caseId ?? null)
  })

  useEffect(() => {
    if (!caseId) {
      setLoading(false)
      setError('缺少病例 ID')
      return
    }
    fetchCaseDetail(caseId)
      .then((detail) => {
        if (!detail) {
          setError('未找到对应病例')
          return
        }
        setRecord(detail)
      })
      .catch((err) => setError(err.message ?? '加载失败'))
      .finally(() => setLoading(false))
  }, [caseId])

  const highlightedSample = useMemo(() => record?.samples?.[0], [record])
  const highlightedReport = useMemo(() => record?.reports?.[0], [record])

  const handleAiContext = () => {
    if (!record) return
    const query: Record<string, string> = {
      contextMode: 'case',
      caseId: record.id,
      caseIdentifier: record.identifier
    }
    if (highlightedSample) {
      query.sampleId = highlightedSample.id
    }
    if (highlightedReport) {
      query.reportId = highlightedReport.id
      if (highlightedReport.summary) {
        query.reportSummary = highlightedReport.summary
      }
    }

    const queryString = Object.entries(query)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')

    Taro.navigateTo({ url: `/pages/ai-chat/index?${queryString}` })
  }

  return (
    <View className='page-case-detail'>
      {loading && <StateHint status='loading' message='加载病例详情中…' />}
      {error && !loading && <StateHint status='error' message={error} />}
      {!loading && record && (
        <>
          <View className='detail-header'>
            <Text className='detail-header__title'>{record.identifier}</Text>
            {record.displayName && (
              <Text className='detail-header__subtitle'>{record.displayName}</Text>
            )}
          </View>

          <View className='detail-tabs'>
            <Text
              className={`detail-tabs__item ${tab === 'analysis' ? 'detail-tabs__item--active' : ''}`}
              onClick={() => setTab('analysis')}
            >
              分析数据
            </Text>
            <Text
              className={`detail-tabs__item ${tab === 'prediction' ? 'detail-tabs__item--active' : ''}`}
              onClick={() => setTab('prediction')}
            >
              预测 & 建议
            </Text>
          </View>

          {tab === 'analysis' && highlightedSample?.analysis && (
            <AnalysisMetrics analysis={highlightedSample.analysis} />
          )}
          {tab === 'analysis' && !highlightedSample?.analysis && (
            <StateHint status='empty' message='该病例暂无分析数据' />
          )}

          {tab === 'prediction' && highlightedReport && (
            <PredictionPanel report={highlightedReport} />
          )}
          {tab === 'prediction' && !highlightedReport && (
            <StateHint status='empty' message='该病例暂无预测建议' />
          )}
        </>
      )}

      <FloatingAiButton onClick={handleAiContext} />
    </View>
  )
}

export default CaseDetailPage
