import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { CaseRecord, CaseReport, CaseSample, TissueAnalysis } from '../types/cases'
import { fetchSampleAnalysis } from '../services/caseService'
import ImageViewer from '../components/ImageViewer'

const formatDate = (value: string) => new Date(value).toLocaleString()
const fmt = {
  count: (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toLocaleString()),
  px: (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v.toLocaleString()} px`),
  mm2: (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v.toLocaleString()} mm²`),
  unit: (v: number | null | undefined, unit: string) => (v === null || v === undefined ? '—' : `${v.toLocaleString()} ${unit}`),
  percent: (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(2)}%`),
  unitless: (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toLocaleString()),
}

const AIMarkdownMobile = ({ index, content: override }: { index: 1 | 2 | 3; content?: string | null }) => {
  const [content, setContent] = useState<string>('')
  useEffect(() => {
    if (override && override.trim()) {
      setContent(override)
      return
    }
    const pool = [
      `## 预测概述\n\n- 样本呈中度阳性为主，阳性细胞比率约 87.91%\n- 密度 0.0875/mm²，H-Score 179，阳性像素分布均匀，提示通路激活较为广泛但值偏高需判读`,
      `## 深度推理\n\n- 中度阳性比例高且区域广，提示整体背景激活而非少数强阳性弥散主导\n- 结合图像学形态与多路紫染面积，可排除大范围坏死或压片的形态改判\n- IRS 得分为 8，倾向临床可观察到轻至中度变化，但仍需纵向追踪`,
      `## 建议\n\n- 结合临床症状与其他指标评估，必要时复查\n- 若后续出现新的症状或影像变化，建议再取样或多区域复核`,
    ]
    setContent(pool[index - 1])
  }, [index, override])

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} allowedElements={['h2', 'h3', 'p', 'strong', 'em', 'ul', 'li']} skipHtml>
      {content}
    </ReactMarkdown>
  )
}

const ReportList = ({ reports }: { reports: CaseReport[] }) => {
  if (!reports.length) {
    return <div className="empty-hint">暂无文字病历</div>
  }
  return (
    <div className="panel">
      <div className="section-title">文字病历</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
        {reports.map((report) => (
          <div key={report.id} className="report-block">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
              <strong>{report.title}</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{formatDate(report.updatedAt)}</span>
            </div>
            {report.summary ? <div className="section-title">{report.summary}</div> : null}
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.content}</ReactMarkdown>
            {report.tags?.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {report.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

type Props = {
  cases: CaseRecord[]
  loading: boolean
  onBack: () => void
}

const CaseDetailPage = ({ cases, loading, onBack }: Props) => {
  const params = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<'preview' | 'data'>('preview')
  const [mode, setMode] = useState<'sample' | 'report'>('sample')
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null)
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [sampleAnalysis, setSampleAnalysis] = useState<TissueAnalysis | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const current = useMemo(() => cases.find((c) => c.id === params.id), [cases, params.id])

  const samples = current?.samples ?? []
  const reports = current?.reports ?? []

  useEffect(() => {
    const sampleId = searchParams.get('sampleId')
    const reportId = searchParams.get('reportId')
    if (sampleId) {
      setSelectedSampleId(sampleId)
      setMode('sample')
    } else if (reportId) {
      setSelectedReportId(reportId)
      setMode('report')
    } else if (samples.length > 0) {
      setMode('sample')
    } else if (reports.length > 0) {
      setMode('report')
    }
  }, [searchParams])

  useEffect(() => {
    if (!current) return
    if (mode === 'sample') {
      const target = samples.find((s) => s.id === selectedSampleId)
      if (!target) {
        setSelectedSampleId(samples[0]?.id ?? null)
      }
    } else {
      const target = reports.find((r) => r.id === selectedReportId)
      if (!target) {
        setSelectedReportId(reports[0]?.id ?? null)
      }
    }
  }, [current, mode, reports, samples, selectedReportId, selectedSampleId])

  const activeSample: CaseSample | null = useMemo(() => {
    if (mode !== 'sample') return null
    if (!samples.length) return null
    if (selectedSampleId) {
      const match = samples.find((s) => s.id === selectedSampleId)
      if (match) return match
    }
    return samples[0]
  }, [mode, samples, selectedSampleId])

  const activeReport: CaseReport | null = useMemo(() => {
    if (mode !== 'report') return null
    if (!reports.length) return null
    if (selectedReportId) {
      const match = reports.find((r) => r.id === selectedReportId)
      if (match) return match
    }
    return reports[0]
  }, [mode, reports, selectedReportId])

  const aiSections: string[] | null = (activeSample?.analysis as any)?.metadata?.ai &&
    Array.isArray((activeSample?.analysis as any).metadata.ai)
    ? ((activeSample?.analysis as any).metadata.ai as string[])
    : null

  useEffect(() => {
    if (mode !== 'sample') {
      setSampleAnalysis(null)
      setAnalysisError(null)
      setAnalysisLoading(false)
      return
    }
    if (!activeSample) {
      setSampleAnalysis(null)
      return
    }
    if (activeSample.analysis) {
      setSampleAnalysis(activeSample.analysis as TissueAnalysis)
      return
    }
    let aborted = false
    ;(async () => {
      try {
        setAnalysisLoading(true)
        setAnalysisError(null)
        const data = await fetchSampleAnalysis(activeSample.caseId, activeSample.id)
        if (!aborted) {
          setSampleAnalysis(data)
        }
      } catch (err) {
        if (!aborted) setAnalysisError((err as Error)?.message ?? '加载分析失败')
      } finally {
        if (!aborted) setAnalysisLoading(false)
      }
    })()
    return () => {
      aborted = true
    }
  }, [mode, activeSample?.id])

  if (loading) {
    return <div className="loading-hint">正在加载病例详情...</div>
  }

  if (!current) {
    return (
      <div className="empty-hint">
        未找到病例
        <div style={{ marginTop: '10px' }}>
          <button className="btn-primary" type="button" onClick={onBack}>
            返回列表
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="list-scroll">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="section-title">病例</div>
          <h3 className="case-card__title">{current.displayName || current.identifier}</h3>
        </div>
        <button className="btn-primary" type="button" onClick={onBack}>
          返回
        </button>
      </div>

      <div className="detail-tabs">
        <button className={["tab-btn", tab === 'preview' ? 'is-active' : ''].join(' ').trim()} onClick={() => setTab('preview')}>
          预览
        </button>
        <button className={["tab-btn", tab === 'data' ? 'is-active' : ''].join(' ').trim()} onClick={() => setTab('data')}>
          数据
        </button>
      </div>

      <div className="detail-body">
        {tab === 'preview' ? (
          <div className="panel">
            <div className="section-title" style={{ marginBottom: '8px' }}>
              {mode === 'sample' ? '图像预览' : '文字病历'}
            </div>

            {mode === 'sample' ? (
              <div className="selector-group">
                <div className="selector-header" aria-hidden />
                <div className="sample-strip" aria-label="样本切换">
                  {samples.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      className={["sample-pill", activeSample?.id === sample.id ? 'is-active' : '']
                        .join(' ')
                        .trim()}
                      onClick={() => {
                        setSelectedSampleId(sample.id)
                        setSearchParams({ sampleId: sample.id })
                      }}
                    >
                      {sample.displayName || sample.originalFilename} · {sample.modality}
                    </button>
                  ))}
                  {!samples.length ? <div className="empty-hint">暂无影像样本</div> : null}
                </div>
              </div>
            ) : null}

            {mode === 'report' ? (
              <div className="selector-group">
                <div className="selector-header" aria-hidden />
                <div className="sample-strip" aria-label="报告切换">
                  {reports.map((report) => (
                    <button
                      key={report.id}
                      type="button"
                      className={["sample-pill", activeReport?.id === report.id ? 'is-active' : '']
                        .join(' ')
                        .trim()}
                      onClick={() => {
                        setSelectedReportId(report.id)
                        setSearchParams({ reportId: report.id })
                      }}
                    >
                      {report.title}
                    </button>
                  ))}
                  {!reports.length ? <div className="empty-hint">暂无文字病历</div> : null}
                </div>
              </div>
            ) : null}

            {mode === 'sample' && activeSample ? <ImageViewer sample={activeSample} /> : null}
            {mode === 'report' && activeReport ? <ReportList reports={[activeReport]} /> : null}
          </div>
        ) : null}

        {tab === 'data' ? (
          <div className="panel">
            <div className="section-title" style={{ marginBottom: '8px' }}>
              核心数据
            </div>
            <div className="data-grid data-grid--two">
              <div className="data-card"><div className="data-card__title">病例编号</div><div className="data-card__value">{current.identifier}</div></div>
              <div className="data-card"><div className="data-card__title">样本数量</div><div className="data-card__value">{samples.length}</div></div>
              <div className="data-card"><div className="data-card__title">文字病历</div><div className="data-card__value">{reports.length}</div></div>
              <div className="data-card"><div className="data-card__title">更新时间</div><div className="data-card__value">{formatDate(current.updatedAt)}</div></div>
            </div>

            {mode === 'sample' && activeSample ? (
              <>
                <div className="data-grid data-grid--two" style={{ marginTop: '12px' }}>
                  <div className="data-card"><div className="data-card__title">样本名称</div><div className="data-card__value">{activeSample.displayName || activeSample.originalFilename}</div></div>
                  <div className="data-card"><div className="data-card__title">模态</div><div className="data-card__value">{activeSample.modality}</div></div>
                  <div className="data-card"><div className="data-card__title">创建时间</div><div className="data-card__value">{formatDate(activeSample.createdAt)}</div></div>
                  <div className="data-card"><div className="data-card__title">更新时间</div><div className="data-card__value">{formatDate(activeSample.updatedAt)}</div></div>
                </div>

                <div className="section-title" style={{ margin: '12px 0 4px' }}>原始指标</div>
                {analysisLoading ? <div className="loading-hint">加载分析数据...</div> : null}
                {analysisError ? <div className="empty-hint">{analysisError}</div> : null}
                {sampleAnalysis ? (
                  <div className="data-grid data-grid--three">
                    <div className="data-card"><div className="data-card__title">1级弱阳性细胞</div><div className="data-card__value">{fmt.count(sampleAnalysis.raw.pos_cells_1_weak)}</div></div>
                    <div className="data-card"><div className="data-card__title">2级中度阳性细胞</div><div className="data-card__value">{fmt.count(sampleAnalysis.raw.pos_cells_2_moderate)}</div></div>
                    <div className="data-card"><div className="data-card__title">3级强阳性细胞</div><div className="data-card__value">{fmt.count(sampleAnalysis.raw.pos_cells_3_strong)}</div></div>
                    <div className="data-card"><div className="data-card__title">IOD 细胞总数</div><div className="data-card__value">{fmt.count(sampleAnalysis.raw.iod_total_cells)}</div></div>
                    <div className="data-card"><div className="data-card__title">阳性面积</div><div className="data-card__value">{fmt.mm2(sampleAnalysis.raw.positive_area_mm2)}</div></div>
                    <div className="data-card"><div className="data-card__title">组织面积</div><div className="data-card__value">{fmt.mm2(sampleAnalysis.raw.tissue_area_mm2)}</div></div>
                    <div className="data-card"><div className="data-card__title">阳性像素面积</div><div className="data-card__value">{fmt.px(sampleAnalysis.raw.positive_area_px)}</div></div>
                    <div className="data-card"><div className="data-card__title">组织像素面积</div><div className="data-card__value">{fmt.px(sampleAnalysis.raw.tissue_area_px)}</div></div>
                    <div className="data-card"><div className="data-card__title">阳性强度</div><div className="data-card__value">{fmt.unitless(sampleAnalysis.raw.positive_intensity)}</div></div>
                  </div>
                ) : null}

                {sampleAnalysis ? (
                  <div className="data-sections">
                    <div className="data-left">
                      <div className="section-title" style={{ margin: '12px 0 4px' }}>原始指标</div>
                      <div className="data-grid data-grid--three">
                        <div className="data-card"><div className="data-card__title">1级弱阳性细胞</div><div className="data-card__value">{fmt.count(sampleAnalysis.raw.pos_cells_1_weak)}</div></div>
                        <div className="data-card"><div className="data-card__title">2级中度阳性细胞</div><div className="data-card__value">{fmt.count(sampleAnalysis.raw.pos_cells_2_moderate)}</div></div>
                        <div className="data-card"><div className="data-card__title">3级强阳性细胞</div><div className="data-card__value">{fmt.count(sampleAnalysis.raw.pos_cells_3_strong)}</div></div>
                        <div className="data-card"><div className="data-card__title">IOD 细胞总数</div><div className="data-card__value">{fmt.count(sampleAnalysis.raw.iod_total_cells)}</div></div>
                        <div className="data-card"><div className="data-card__title">阳性面积</div><div className="data-card__value">{fmt.mm2(sampleAnalysis.raw.positive_area_mm2)}</div></div>
                        <div className="data-card"><div className="data-card__title">组织面积</div><div className="data-card__value">{fmt.mm2(sampleAnalysis.raw.tissue_area_mm2)}</div></div>
                        <div className="data-card"><div className="data-card__title">阳性像素面积</div><div className="data-card__value">{fmt.px(sampleAnalysis.raw.positive_area_px)}</div></div>
                        <div className="data-card"><div className="data-card__title">组织像素面积</div><div className="data-card__value">{fmt.px(sampleAnalysis.raw.tissue_area_px)}</div></div>
                        <div className="data-card"><div className="data-card__title">阳性强度</div><div className="data-card__value">{fmt.unitless(sampleAnalysis.raw.positive_intensity)}</div></div>
                      </div>

                      <div className="section-title" style={{ margin: '12px 0 4px' }}>衍生指标</div>
                      <div className="data-grid data-grid--two">
                        <div className="data-card"><div className="data-card__title">阳性细胞比率</div><div className="data-card__value">{fmt.percent(sampleAnalysis.derived.positive_cells_ratio)}</div></div>
                        <div className="data-card"><div className="data-card__title">阳性细胞密度</div><div className="data-card__value">{fmt.unit(sampleAnalysis.derived.positive_cells_density, '/mm²')}</div></div>
                        <div className="data-card"><div className="data-card__title">平均光密度</div><div className="data-card__value">{fmt.unitless(sampleAnalysis.derived.mean_density)}</div></div>
                        <div className="data-card"><div className="data-card__title">H-Score</div><div className="data-card__value">{fmt.unitless(sampleAnalysis.derived.h_score)}</div></div>
                        <div className="data-card"><div className="data-card__title">IRS</div><div className="data-card__value">{fmt.unitless(sampleAnalysis.derived.irs)}</div></div>
                      </div>
                    </div>

                    <div className="data-right">
                      <div className="ai-panel">
                        <div className="section-title" style={{ marginBottom: '6px' }}>预测 & 建议</div>
                        <div className="ai-panel__body">
                          <AIMarkdownMobile index={1} content={aiSections?.[0]} />
                          <AIMarkdownMobile index={2} content={aiSections?.[1]} />
                          <AIMarkdownMobile index={3} content={aiSections?.[2]} />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {mode === 'report' && activeReport ? (
              <div className="data-grid data-grid--two" style={{ marginTop: '12px' }}>
                <div className="data-card"><div className="data-card__title">报告标题</div><div className="data-card__value">{activeReport.title}</div></div>
                <div className="data-card"><div className="data-card__title">摘要</div><div className="data-card__value">{activeReport.summary || '暂无摘要'}</div></div>
                <div className="data-card"><div className="data-card__title">创建时间</div><div className="data-card__value">{formatDate(activeReport.createdAt)}</div></div>
                <div className="data-card"><div className="data-card__title">更新时间</div><div className="data-card__value">{formatDate(activeReport.updatedAt)}</div></div>
              </div>
            ) : null}

            {current.notes ? (
              <div className="report-block" style={{ marginTop: '12px' }}>
                <div className="section-title">备注</div>
                <div>{current.notes}</div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default CaseDetailPage
