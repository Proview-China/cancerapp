import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { AnalysisSidebar } from './components/AnalysisSidebar'
import { PreferencesSidebar } from './components/PreferencesSidebar'
import { PreferencesContent, type PreferencePage } from './components/PreferencesContent'
import { CasesWorkspace } from './components/CasesWorkspace'
import type { CaseCreateSample, CaseRecord, CaseReportDraft } from './types/cases'
import {
  fetchCases,
  createCase,
  deleteCase,
  deleteCaseSample,
  createCaseReport,
  updateCaseReport,
  deleteCaseReport,
} from './services/caseService'

const MIN_SIDEBAR_WIDTH = 360
const MAX_SIDEBAR_WIDTH = 420

type PageKey = 'analysis' | 'data' | 'tasks' | 'preferences'

const MENU_ITEMS: Array<{ label: string; key: PageKey }> = [
  { label: '病例', key: 'analysis' },
  { label: '分析', key: 'data' },
  { label: '任务', key: 'tasks' },
  { label: '设置', key: 'preferences' },
]

const SIDEBAR_ENABLED: Record<PageKey, boolean> = {
  analysis: true,
  data: true,
  tasks: true,
  preferences: true,
}

function App() {
  const [sidebarWidths, setSidebarWidths] = useState<Record<PageKey, number>>({
    analysis: 280,
    data: 280,
    tasks: 280,
    preferences: 280,
  })
  const [resizingKey, setResizingKey] = useState<PageKey | null>(null)
  const [activePage, setActivePage] = useState<PageKey>('analysis')
  const [preferencesPage, setPreferencesPage] = useState<PreferencePage>('appearance')
  const [cases, setCases] = useState<CaseRecord[]>([])
  const [importingCase, setImportingCase] = useState(false)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null)
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const resizeOrigin = useRef<{ startX: number; startWidth: number; pageKey: PageKey | null }>({
    startX: 0,
    startWidth: 0,
    pageKey: null,
  })
  const handleResizeStart = useCallback(
    (pageKey: PageKey, event: React.PointerEvent<HTMLDivElement>) => {
      const startWidth = sidebarWidths[pageKey] ?? MIN_SIDEBAR_WIDTH
      resizeOrigin.current = { startX: event.clientX, startWidth, pageKey }
      setResizingKey(pageKey)
      event.preventDefault()
    },
    [sidebarWidths],
  )

  useEffect(() => {
    if (!resizingKey) {
      document.body.classList.remove('is-resizing')
      return
    }

    document.body.classList.add('is-resizing')

    const handlePointerMove = (event: PointerEvent) => {
      const { pageKey } = resizeOrigin.current
      if (!pageKey) {
        return
      }

      const delta = event.clientX - resizeOrigin.current.startX
      const next = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, resizeOrigin.current.startWidth + delta),
      )

      setSidebarWidths((prev) => {
        if (prev[pageKey] === next) {
          return prev
        }

        return { ...prev, [pageKey]: next }
      })
    }

    const stopResizing = () => {
      document.body.classList.remove('is-resizing')
      setResizingKey(null)
      resizeOrigin.current = { startX: 0, startWidth: 0, pageKey: null }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResizing)
    window.addEventListener('pointercancel', stopResizing)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResizing)
      window.removeEventListener('pointercancel', stopResizing)
    }
  }, [resizingKey])

  const handleWindowControl = useCallback(async (action: 'minimize' | 'toggle-maximize' | 'close') => {
    if (!window.electronAPI) {
      return
    }

    try {
      switch (action) {
        case 'minimize':
          await window.electronAPI.minimize()
          break
        case 'toggle-maximize':
          await window.electronAPI.toggleMaximize()
          break
        case 'close':
          await window.electronAPI.close()
          break
      }
    } catch (error) {
      console.error('窗口控制失败', error)
    }
  }, [])

  const loadCases = useCallback(async () => {
    try {
      const data = await fetchCases()
      setCases(data)
      if (data.length > 0) {
        setSelectedCaseId((current) => (current && data.some((item) => item.id === current) ? current : data[0].id))
      }
    } catch (error) {
      console.error('加载病例列表失败', error)
    }
  }, [])

  useEffect(() => {
    loadCases()
  }, [loadCases])

  useEffect(() => {
    if (!selectedCaseId) {
      if (cases.length > 0) {
        setSelectedCaseId(cases[0].id)
      }
      return
    }

    const target = cases.find((item) => item.id === selectedCaseId)
    if (!target) {
      setSelectedCaseId(cases.length > 0 ? cases[0].id : null)
      setSelectedSampleId(null)
      setSelectedReportId(null)
      return
    }

    const hasSample = target.samples.some((sample) => sample.id === selectedSampleId)
    const hasReport = target.reports.some((report) => report.id === selectedReportId)

    if (selectedSampleId && !hasSample) {
      setSelectedSampleId(target.samples.length > 0 ? target.samples[0].id : null)
    }

    if (selectedReportId && !hasReport) {
      setSelectedReportId(target.reports.length > 0 ? target.reports[0].id : null)
    }

    if (!selectedSampleId && !selectedReportId) {
      if (target.samples.length > 0) {
        setSelectedSampleId(target.samples[0].id)
      } else if (target.reports.length > 0) {
        setSelectedReportId(target.reports[0].id)
      }
    }
  }, [cases, selectedCaseId, selectedSampleId, selectedReportId])

  const handleSelectCase = useCallback((caseId: string) => {
    setSelectedCaseId(caseId)
  }, [])

  const handleSelectSample = useCallback((caseId: string, sampleId: string) => {
    setSelectedCaseId(caseId)
    setSelectedSampleId(sampleId)
    setSelectedReportId(null)
  }, [])

  const handleSelectReport = useCallback((caseId: string, reportId: string) => {
    setSelectedCaseId(caseId)
    setSelectedReportId(reportId)
    setSelectedSampleId(null)
  }, [])

  const handleImportCase = useCallback(
    async ({
      identifier,
      samples,
      textReports,
    }: {
      identifier: string
      samples: CaseCreateSample[]
      textReports: CaseReportDraft[]
    }) => {
      setImportingCase(true)
      try {
        const created = await createCase({ identifier, samples, textReports })
        setCases((prev) => {
          const existingIndex = prev.findIndex((item) => item.id === created.id)
          if (existingIndex >= 0) {
            const next = [...prev]
            next[existingIndex] = created
            return next
          }
          return [created, ...prev]
        })
        setSelectedCaseId(created.id)
        if (created.samples.length > 0) {
          setSelectedSampleId(created.samples[0].id)
          setSelectedReportId(null)
        } else if (created.reports.length > 0) {
          setSelectedReportId(created.reports[0].id)
          setSelectedSampleId(null)
        } else {
          setSelectedSampleId(null)
          setSelectedReportId(null)
        }
      } catch (error) {
        if (error instanceof Error) {
          throw error
        }
        throw new Error('导入病例失败')
      } finally {
        setImportingCase(false)
      }
    },
    [],
  )

  const handleDeleteCase = useCallback(
    async (caseId: string) => {
      await deleteCase(caseId)
      const nextCases = cases.filter((item) => item.id !== caseId)
      setCases(nextCases)

      if (selectedCaseId === caseId) {
        setSelectedCaseId(nextCases.length > 0 ? nextCases[0].id : null)
        setSelectedSampleId(null)
        setSelectedReportId(null)
      } else {
        setSelectedSampleId((current) => {
          if (!current) return current
          const stillExists = nextCases.some((item) => item.samples.some((sample) => sample.id === current))
          return stillExists ? current : null
        })
        setSelectedReportId((current) => {
          if (!current) return current
          const stillExists = nextCases.some((item) => item.reports.some((report) => report.id === current))
          return stillExists ? current : null
        })
      }
    },
    [cases, selectedCaseId],
  )

  const handleDeleteSample = useCallback(
    async (caseId: string, sampleId: string) => {
      await deleteCaseSample(caseId, sampleId)
      setCases((prev) => {
        const next = prev.map((item) =>
          item.id === caseId
            ? { ...item, samples: item.samples.filter((sample) => sample.id !== sampleId) }
            : item,
        )
        if (selectedSampleId === sampleId) {
          const updatedCase = next.find((item) => item.id === caseId)
          setSelectedSampleId(updatedCase && updatedCase.samples.length > 0 ? updatedCase.samples[0].id : null)
        }
        return next
      })
    },
    [selectedSampleId],
  )

  const handleDeleteReport = useCallback(async (caseId: string, reportId: string) => {
    await deleteCaseReport(caseId, reportId)
    setCases((prev) => {
      const next = prev.map((item) =>
        item.id === caseId ? { ...item, reports: item.reports.filter((report) => report.id !== reportId) } : item,
      )
      const target = next.find((item) => item.id === caseId)
      setSelectedReportId((current) => {
        if (current !== reportId) {
          return current
        }
        if (target && target.reports.length > 0) {
          return target.reports[0].id
        }
        return null
      })
      return next
    })
  }, [])

  const handleCreateReport = useCallback(
    async (caseId: string, payload: CaseReportDraft) => {
      const report = await createCaseReport(caseId, payload)
      setCases((prev) =>
        prev.map((item) => (item.id === caseId ? { ...item, reports: [report, ...item.reports] } : item)),
      )
      setSelectedCaseId(caseId)
      setSelectedReportId(report.id)
      setSelectedSampleId(null)
    },
    [],
  )

  const handleUpdateReport = useCallback(
    async (caseId: string, reportId: string, payload: Partial<CaseReportDraft>) => {
      const updated = await updateCaseReport(caseId, reportId, payload)
      setCases((prev) =>
        prev.map((item) =>
          item.id === caseId
            ? {
                ...item,
                reports: item.reports.map((report) => (report.id === reportId ? updated : report)),
              }
            : item,
        ),
      )
      setSelectedCaseId(caseId)
      setSelectedReportId(reportId)
      setSelectedSampleId(null)
    },
    [],
  )

  const activeIndex = MENU_ITEMS.findIndex((item) => item.key === activePage)

  return (
    <div className="app-shell">
      <header className="menubar">
        <div className="menubar__brand">
          <span className="brand__logo" aria-hidden>
            CA
          </span>
          <div className="brand__text">
            <strong>CancerApp</strong>
            <span>临床智能工作台</span>
          </div>
        </div>
        <nav className="menubar__nav" role="tablist" aria-label="导航">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.key}
              className={['nav-button', item.key === activePage ? 'is-active' : ''].join(' ').trim()}
              type="button"
              role="tab"
              aria-selected={item.key === activePage}
              onClick={() => setActivePage(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="window-controls" aria-label="窗口控制">
          <button
            className="control-dot control-dot--min"
            aria-label="最小化"
            onClick={() => handleWindowControl('minimize')}
          />
          <button
            className="control-dot control-dot--max"
            aria-label="切换大小"
            onClick={() => handleWindowControl('toggle-maximize')}
          />
          <button
            className="control-dot control-dot--close"
            aria-label="关闭"
            onClick={() => handleWindowControl('close')}
          />
        </div>
      </header>

      <div className="workspace">
        <main className="canvas" aria-live="polite">
          <div
            className="canvas-slider"
            style={{ transform: `translate3d(-${Math.max(activeIndex, 0) * 100}%, 0, 0)` }}
          >
            {MENU_ITEMS.map((item) => {
              const hasSidebar = SIDEBAR_ENABLED[item.key]
              const isActive = item.key === activePage
              const sidebarWidth = hasSidebar ? sidebarWidths[item.key] ?? MIN_SIDEBAR_WIDTH : undefined
              const isResizingCurrent = resizingKey === item.key
              const shouldUseAnalysisSidebar = ['analysis', 'data', 'tasks'].includes(item.key)
              return (
                <section key={item.key} className="canvas-page" aria-label={item.label}>
                  <div
                    className={['canvas-page__layout', hasSidebar ? 'has-sidebar' : 'no-sidebar'].join(' ')}
                    style={{
                      gridTemplateColumns: hasSidebar && sidebarWidth
                        ? `${sidebarWidth}px 6px minmax(0, 1fr)`
                        : undefined,
                    }}
                  >
                    {hasSidebar ? (
                      <>
                        {shouldUseAnalysisSidebar ? (
                          <AnalysisSidebar
                            cases={cases}
                            selectedCaseId={selectedCaseId}
                            selectedSampleId={selectedSampleId}
                            selectedReportId={selectedReportId}
                            onSelectCase={handleSelectCase}
                            onSelectSample={handleSelectSample}
                            onSelectReport={handleSelectReport}
                            onImportCase={handleImportCase}
                            onDeleteCase={handleDeleteCase}
                            onDeleteSample={handleDeleteSample}
                            onDeleteReport={handleDeleteReport}
                            onCreateReport={handleCreateReport}
                            onUpdateReport={handleUpdateReport}
                            isImporting={importingCase}
                          />
                        ) : null}
                        {item.key === 'preferences' && (
                          <PreferencesSidebar activePage={preferencesPage} onPageChange={setPreferencesPage} />
                        )}
                        <div
                          className={['sidebar__resizer', isResizingCurrent && isActive ? 'is-active' : '']
                            .join(' ')
                            .trim()}
                          onPointerDown={isActive ? (event) => handleResizeStart(item.key, event) : undefined}
                          role="separator"
                          aria-orientation="vertical"
                          aria-label="调整侧栏宽度"
                        />
                      </>
                    ) : null}
                    <div className={['canvas-page__main', item.key === 'preferences' ? 'preferences-layout' : ''].join(' ').trim()}>
                      {item.key === 'preferences' ? (
                        <PreferencesContent activePage={preferencesPage} onPageChange={setPreferencesPage} />
                      ) : item.key === 'analysis' ? (
                        <CasesWorkspace
                          cases={cases}
                          selectedCaseId={selectedCaseId}
                          selectedSampleId={selectedSampleId}
                          selectedReportId={selectedReportId}
                        />
                      ) : item.key === 'data' ? (
                        <span className="canvas-page__title">分析</span>
                      ) : item.key === 'tasks' ? (
                        <span className="canvas-page__title">任务</span>
                      ) : null}
                    </div>
                  </div>
                </section>
              )
            })}
          </div>
        </main>
      </div>

      <section className="stats-bar" aria-hidden />
    </div>
  )
}

export default App
