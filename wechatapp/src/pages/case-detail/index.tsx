import { View, Text } from '@tarojs/components'
import Taro, { useLoad, useRouter } from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { fetchCaseDetail } from '../../services/cases'
import type { CaseRecord } from '../../types/cases'
import { PreviewPanel } from '../../components/PreviewPanel'
import { AnalysisPanel } from '../../components/AnalysisPanel'
import { FloatingAiButton } from '../../components/FloatingAiButton'
import { StateHint } from '../../components/StateHint'
import './index.scss'

type TabKey = 'preview' | 'analysis'

function CaseDetailPage() {
  const router = useRouter()
  const [caseId, setCaseId] = useState<string | null>(null)
  const [record, setRecord] = useState<CaseRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('preview')

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

  const handleBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack()
    } else {
      Taro.switchTab({ url: '/pages/index/index' })
    }
  }

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
    <View className='page-case-detail page-shell'>
      {loading && <StateHint status='loading' message='加载病例详情中…' />}
      {error && !loading && <StateHint status='error' message={error} />}
      {!loading && record && (
        <>
          <View className='detail-top'>
            <View className='nav-back' onClick={handleBack}>
              <Text className='nav-back__icon'>←</Text>
            </View>
            <View className='detail-header'>
              <Text className='detail-header__title'>{record.identifier}</Text>
              {record.displayName && (
                <Text className='detail-header__subtitle'>{record.displayName}</Text>
              )}
            </View>
          </View>

          <View className='detail-tabs'>
            <Text
              className={`detail-tabs__item ${tab === 'preview' ? 'detail-tabs__item--active' : ''}`}
              onClick={() => setTab('preview')}
            >
              预览
            </Text>
            <Text
              className={`detail-tabs__item ${tab === 'analysis' ? 'detail-tabs__item--active' : ''}`}
              onClick={() => setTab('analysis')}
            >
              数据分析
            </Text>
          </View>

          {tab === 'preview' && (
            <>
              {(highlightedSample || highlightedReport) && (
                <PreviewPanel sample={highlightedSample ?? null} report={highlightedReport ?? null} />
              )}
              {!highlightedSample && !highlightedReport && (
                <StateHint status='empty' message='暂无图像或文字可预览' />
              )}
            </>
          )}

          {tab === 'analysis' && (
            <AnalysisPanel
              caseIdentifier={record.identifier}
              sample={highlightedSample ?? null}
              report={highlightedReport ?? null}
            />
          )}
        </>
      )}

      <FloatingAiButton onClick={handleAiContext} />
    </View>
  )
}

export default CaseDetailPage
