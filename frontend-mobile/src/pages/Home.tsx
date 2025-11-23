import { useEffect, useMemo, useRef, useState } from 'react'
import type { CaseRecord, CaseSample, CaseReport } from '../types/cases'
import { useNavigate } from 'react-router-dom'

type HomeProps = {
  cases: CaseRecord[]
  loading: boolean
  error: string | null
}

const formatCount = (value: number, label: string) => `${label} ${value}`

const SamplePreview = ({ sample, onOpen }: { sample: CaseSample; onOpen: () => void }) => {
  const thumb = sample.thumbnailUrl || sample.imageUrl
  return (
    <button className="preview-item preview-item--clickable" type="button" onClick={onOpen}>
      <div className="preview-text">
        <div className="preview-title">{sample.displayName || sample.originalFilename}</div>
        <div className="preview-meta">{sample.modality}</div>
      </div>
      <div className="preview-thumb" aria-hidden>
        <img src={thumb} alt="" />
      </div>
    </button>
  )
}

const ReportPreview = ({ report, onOpen }: { report: CaseReport; onOpen: () => void }) => (
  <button className="preview-item preview-item--clickable" type="button" onClick={onOpen}>
    <div className="preview-text">
      <div className="preview-title">{report.title}</div>
      <div className="preview-meta">{report.summary || '暂无摘要'}</div>
    </div>
  </button>
)

const HomePage = ({ cases, loading, error }: HomeProps) => {
  const [openCards, setOpenCards] = useState<Set<string>>(new Set())
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const navigate = useNavigate()
  const initialized = useRef(false)

  const toggle = (id: string) => {
    setOpenCards((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSection = (id: string, key: 'samples' | 'reports') => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      const composite = `${id}-${key}`
      if (next.has(composite)) next.delete(composite)
      else next.add(composite)
      return next
    })
  }

  const sortedCases = useMemo(() => cases.slice().sort((a, b) => a.updatedAt < b.updatedAt ? 1 : -1), [cases])

  useEffect(() => {
    if (initialized.current) return
    if (cases.length === 0) return
    setOpenCards(new Set([cases[0].id]))
    setCollapsedSections(new Set())
    initialized.current = true
  }, [cases])

  if (loading) {
    return <div className="loading-hint">正在加载病例列表...</div>
  }

  if (error) {
    return <div className="empty-hint">{error}</div>
  }

  if (!cases.length) {
    return <div className="empty-hint">暂无病例数据，等待后端或假数据加载。</div>
  }

  return (
    <div className="list-scroll">
      {sortedCases.map((item) => {
        const sampleCount = item.samples.length
        const reportCount = item.reports.length
        const display = item.displayName || item.identifier
        const summary = item.reports[0]?.summary || item.reports[0]?.title || '未提供摘要'
        const isOpen = openCards.has(item.id)
        const sampleOpen = isOpen && !collapsedSections.has(`${item.id}-samples`)
        const reportOpen = isOpen && !collapsedSections.has(`${item.id}-reports`)

        return (
          <div key={item.id} className="case-card case-card--accordion">
              <div className="case-card__header" aria-expanded={isOpen}>
              <div className="case-card__title-row">
                <h3 className="case-card__title">{display}</h3>
                <div className="count-group">
                  <span className="tag">{formatCount(sampleCount, '影像')}</span>
                  <span className="tag">{formatCount(reportCount, '文字')}</span>
                </div>
                <button className="toggle-btn" type="button" onClick={() => toggle(item.id)}>
                  {isOpen ? '收起' : '展开'}
                </button>
              </div>
              <div className="case-card__meta-line section-title--tiny">
                <div className="section-title section-title--tiny">{summary}</div>
                <div className="tag tag--inline">更新时间 {new Date(item.updatedAt).toLocaleString()}</div>
              </div>
            </div>

            {isOpen ? (
              <div className="case-card__body">
                <div className="section-line">
                  <div className="section-title">影像</div>
                  <button
                    className="toggle-btn toggle-btn--light"
                    type="button"
                    onClick={() => toggleSection(item.id, 'samples')}
                  >
                    {sampleOpen ? '收起' : '展开'}
                  </button>
                </div>
                {item.samples.length ? (
                  sampleOpen ? (
                    <div className="preview-list">
                      {item.samples.map((sample) => (
                        <SamplePreview
                          key={sample.id}
                          sample={sample}
                          onOpen={() => navigate(`/case/${item.id}?sampleId=${sample.id}`)}
                        />
                      ))}
                    </div>
                  ) : null
                ) : (
                  <div className="empty-hint">暂无影像样本</div>
                )}

                <div className="section-line" style={{ marginTop: '10px' }}>
                  <div className="section-title">文字</div>
                  <button
                    className="toggle-btn toggle-btn--light"
                    type="button"
                    onClick={() => toggleSection(item.id, 'reports')}
                  >
                    {reportOpen ? '收起' : '展开'}
                  </button>
                </div>
                {item.reports.length ? (
                  reportOpen ? (
                    <div className="preview-list">
                      {item.reports.map((report) => (
                        <ReportPreview
                          key={report.id}
                          report={report}
                          onOpen={() => navigate(`/case/${item.id}?reportId=${report.id}`)}
                        />
                      ))}
                    </div>
                  ) : null
                ) : (
                  <div className="empty-hint">暂无文字病历</div>
                )}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export default HomePage
