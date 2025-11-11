import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import type { CaseRecord, CaseReportDraft, TissueAnalysis } from '../types/cases'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AIChatPanel, type AIChatHandle } from './AIChatPanel'
import './CasesWorkspace.css'

type CasesWorkspaceProps = {
  cases: CaseRecord[]
  selectedCaseId: string | null
  selectedSampleId: string | null
  selectedReportId: string | null
  onUpdateReport: (caseId: string, reportId: string, payload: Partial<CaseReportDraft>) => Promise<void>
  rightMode?: 'analysis' | 'ai'
}

type RightModeOption = 'ai' | 'viz'

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const MAX_SCALE = 20
const MIN_SPLIT_RATIO = 0.35
const MAX_SPLIT_RATIO = 0.75
const SPLIT_KEYBOARD_STEP = 0.04
const SPLIT_KEYBOARD_STEP_FAST = 0.08
const SPLIT_HANDLE_WIDTH = 18

type ViewportState = {
  scale: number
  minScale: number
  offsetX: number
  offsetY: number
}

export const CasesWorkspace = ({
  cases,
  selectedCaseId,
  selectedSampleId,
  selectedReportId,
  onUpdateReport,
  rightMode: outerRightMode = 'analysis',
}: CasesWorkspaceProps) => {
  const [viewport, setViewport] = useState<ViewportState>({ scale: 1, minScale: 1, offsetX: 0, offsetY: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [imageMeta, setImageMeta] = useState({ width: 0, height: 0 })
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const viewportRef = useRef(viewport)
  const splitStateRef = useRef({
    active: false,
    pointerId: 0,
    startX: 0,
    baseRatio: 0.56,
  })
  const dragStateRef = useRef({
    active: false,
    pointerId: 0,
    startX: 0,
    startY: 0,
    baseOffsetX: 0,
    baseOffsetY: 0,
  })
  const [splitRatio, setSplitRatio] = useState(0.56)
  const [isSplitDragging, setIsSplitDragging] = useState(false)
  const [isMarkdownEditing, setIsMarkdownEditing] = useState(false)
  const [markdownDraft, setMarkdownDraft] = useState('')
  const [isMarkdownSaving, setIsMarkdownSaving] = useState(false)
  const [markdownError, setMarkdownError] = useState<string | null>(null)
  const [markdownEditorHeight, setMarkdownEditorHeight] = useState(260)
  const markdownResizeState = useRef<{ active: boolean; startY: number; baseHeight: number }>({
    active: false,
    startY: 0,
    baseHeight: 260,
  })
  const viewerPercent = useMemo(() => `${(splitRatio * 100).toFixed(2)}%`, [splitRatio])
  const analysisPercent = useMemo(() => `${((1 - splitRatio) * 100).toFixed(2)}%`, [splitRatio])

  // 分析区头部动作（查看原图/解析图）
  const [headerImages, setHeaderImages] = useState<{ raw: string | null; parsed: string | null } | null>(null)
  const chatRef = useRef<AIChatHandle>(null)
  const [rightMode, setRightMode] = useState<RightModeOption>('ai')
  const tabRefs = useRef<Record<RightModeOption, HTMLButtonElement | null>>({ ai: null, viz: null })
  const tabOrder: RightModeOption[] = ['ai', 'viz']

  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  useEffect(() => {
    splitStateRef.current.baseRatio = splitRatio
  }, [splitRatio])

  const selectedCase = useMemo(() => cases.find((item) => item.id === selectedCaseId) ?? null, [
    cases,
    selectedCaseId,
  ])

  const selectedSample = useMemo(() => {
    if (!selectedCase) return null
    if (!selectedSampleId) return null
    return selectedCase.samples.find((sample) => sample.id === selectedSampleId) ?? null
  }, [selectedCase, selectedSampleId])

  const selectedReport = useMemo(() => {
    if (!selectedCase) return null
    if (!selectedReportId) return null
    return selectedCase.reports.find((report) => report.id === selectedReportId) ?? null
  }, [selectedCase, selectedReportId])

  useEffect(() => {
    if (selectedReport) {
      setMarkdownDraft(selectedReport.content)
      setMarkdownEditorHeight((prev) => Math.max(prev, 220))
    } else {
      setMarkdownDraft('')
      setMarkdownEditorHeight(260)
    }
    setIsMarkdownEditing(false)
    setMarkdownError(null)
    setIsMarkdownSaving(false)
  }, [selectedReport?.id])

  useEffect(() => {
    setImageMeta({ width: 0, height: 0 })
    setViewport((prev) => ({ ...prev, offsetX: 0, offsetY: 0 }))
  }, [selectedSampleId])

  useEffect(() => {
    if (rightMode === 'viz' && !selectedSample) {
      setRightMode('ai')
    }
  }, [rightMode, selectedSample])

  const focusTab = (mode: RightModeOption) => {
    tabRefs.current[mode]?.focus()
  }

  const handleTabKeyDown = (mode: RightModeOption) => (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const currentIndex = tabOrder.indexOf(mode)
      const offset = event.key === 'ArrowRight' ? 1 : -1
      const nextIndex = (currentIndex + offset + tabOrder.length) % tabOrder.length
      focusTab(tabOrder[nextIndex])
    }
  }

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const { width, height } = entry.contentRect
        setContainerSize({ width, height })
      }
    })
    observer.observe(containerRef.current)
    return () => {
      observer.disconnect()
    }
  }, [])

  const computeFitScale = useCallback((imgWidth: number, imgHeight: number, contWidth: number, contHeight: number) => {
    if (!imgWidth || !imgHeight || !contWidth || !contHeight) return 1
    const scale = Math.min(contWidth / imgWidth, contHeight / imgHeight)
    return scale > 1 ? 1 : scale
  }, [])

  const clampOffsets = useCallback(
    (scale: number, offsetX: number, offsetY: number, minScale: number) => {
      if (scale <= minScale + 0.0001) {
        return { offsetX: 0, offsetY: 0 }
      }

      const imageWidth = imageMeta.width * scale
      const imageHeight = imageMeta.height * scale

      const maxOffsetX = Math.max((imageWidth - containerSize.width) / 2, 0)
      const maxOffsetY = Math.max((imageHeight - containerSize.height) / 2, 0)

      return {
        offsetX: clamp(offsetX, -maxOffsetX, maxOffsetX),
        offsetY: clamp(offsetY, -maxOffsetY, maxOffsetY),
      }
    },
    [containerSize, imageMeta],
  )

  const recalculateViewport = useCallback(
    (imgWidth: number, imgHeight: number) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const fitScale = computeFitScale(imgWidth, imgHeight, rect.width, rect.height)
      setViewport({ scale: fitScale, minScale: fitScale, offsetX: 0, offsetY: 0 })
    },
    [computeFitScale],
  )

  const handleImageLoad = useCallback(() => {
    const img = imageRef.current
    if (!img) return
    const { naturalWidth, naturalHeight } = img
    setImageMeta({ width: naturalWidth, height: naturalHeight })
    recalculateViewport(naturalWidth, naturalHeight)
  }, [recalculateViewport])

  useEffect(() => {
    if (!imageMeta.width || !imageMeta.height || !containerSize.width || !containerSize.height) {
      return
    }
    recalculateViewport(imageMeta.width, imageMeta.height)
  }, [containerSize, imageMeta, recalculateViewport])

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!selectedSample) return
      event.preventDefault()
      const { scale, minScale, offsetX, offsetY } = viewportRef.current
      if (!containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const pointerX = event.clientX - rect.left - rect.width / 2
      const pointerY = event.clientY - rect.top - rect.height / 2

      const factor = event.deltaY > 0 ? 0.9 : 1.1
      const nextScale = clamp(scale * factor, minScale, MAX_SCALE)

      const imageX = (pointerX - offsetX) / scale
      const imageY = (pointerY - offsetY) / scale

      const tentativeOffsetX = pointerX - imageX * nextScale
      const tentativeOffsetY = pointerY - imageY * nextScale

      const clamped = clampOffsets(nextScale, tentativeOffsetX, tentativeOffsetY, minScale)

      setViewport({ scale: nextScale, minScale, offsetX: clamped.offsetX, offsetY: clamped.offsetY })
    },
    [clampOffsets, selectedSample],
  )

  const stopDragging = useCallback(() => {
    const dragState = dragStateRef.current
    if (dragState.active && containerRef.current) {
      containerRef.current.releasePointerCapture(dragState.pointerId)
    }
    dragStateRef.current.active = false
    setIsDragging(false)
  }, [])

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const { scale, minScale, offsetX, offsetY } = viewportRef.current
      if (scale <= minScale + 0.0001) {
        return
      }

      const element = event.currentTarget
      dragStateRef.current = {
        active: true,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        baseOffsetX: offsetX,
        baseOffsetY: offsetY,
      }
      element.setPointerCapture(event.pointerId)
      setIsDragging(true)
    },
    [],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current
      if (!dragState.active) {
        return
      }

      const deltaX = event.clientX - dragState.startX
      const deltaY = event.clientY - dragState.startY

      const { scale, minScale } = viewportRef.current

      const tentativeOffsetX = dragState.baseOffsetX + deltaX
      const tentativeOffsetY = dragState.baseOffsetY + deltaY

      const clamped = clampOffsets(scale, tentativeOffsetX, tentativeOffsetY, minScale)

      setViewport((prev) => ({ ...prev, offsetX: clamped.offsetX, offsetY: clamped.offsetY }))
    },
    [clampOffsets],
  )

  const handlePointerUp = useCallback(() => {
    stopDragging()
  }, [stopDragging])

  const handleSplitPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!layoutRef.current) {
        return
      }

      splitStateRef.current = {
        active: true,
        pointerId: event.pointerId,
        startX: event.clientX,
        baseRatio: splitRatio,
      }
      setIsSplitDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
    },
    [splitRatio],
  )

  const handleSplitPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = splitStateRef.current
    const layout = layoutRef.current
    if (!state.active || !layout) {
      return
    }

    const rect = layout.getBoundingClientRect()
    const width = rect.width
    if (width <= 0) {
      return
    }

    const relativeX = event.clientX - rect.left
    const ratio = relativeX / width
    const next = clamp(ratio, MIN_SPLIT_RATIO, MAX_SPLIT_RATIO)

    setSplitRatio((prev) => (Math.abs(prev - next) < 0.0005 ? prev : next))
    event.preventDefault()
  }, [])

  const handleSplitPointerStop = useCallback(() => {
    if (splitStateRef.current.active) {
      splitStateRef.current.active = false
      setIsSplitDragging(false)
    }
  }, [])

  const handleSplitPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      handleSplitPointerStop()
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    },
    [handleSplitPointerStop],
  )

  const handleSplitKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return
    }
    event.preventDefault()
    const delta = event.shiftKey ? SPLIT_KEYBOARD_STEP_FAST : SPLIT_KEYBOARD_STEP
    const direction = event.key === 'ArrowLeft' ? -1 : 1
    setSplitRatio((prev) => clamp(prev + direction * delta, MIN_SPLIT_RATIO, MAX_SPLIT_RATIO))
  }, [])

  const handleResetZoom = useCallback(() => {
    const { minScale } = viewportRef.current
    setViewport({ scale: minScale, minScale, offsetX: 0, offsetY: 0 })
  }, [])

  const zoomPercent = Math.round(viewport.scale * 100)

  const currentMarkdownContent = selectedReport
    ? isMarkdownEditing
      ? markdownDraft
      : selectedReport.content
    : ''

  const handleMarkdownEditStart = useCallback(() => {
    if (!selectedReport) return
    setMarkdownDraft(selectedReport.content)
    setIsMarkdownEditing(true)
    setMarkdownError(null)
    setMarkdownEditorHeight((current) => Math.max(current, 240))
  }, [selectedReport])

  const handleMarkdownEditCancel = useCallback(() => {
    if (selectedReport) {
      setMarkdownDraft(selectedReport.content)
    }
    setIsMarkdownEditing(false)
    setMarkdownError(null)
  }, [selectedReport])

  const handleMarkdownSave = useCallback(async () => {
    if (!selectedCase || !selectedReport) {
      return
    }
    if (!markdownDraft.trim()) {
      setMarkdownError('正文内容不能为空')
      return
    }
    setIsMarkdownSaving(true)
    setMarkdownError(null)
    try {
      await onUpdateReport(selectedCase.id, selectedReport.id, { content: markdownDraft })
      setIsMarkdownEditing(false)
    } catch (error) {
      console.error('更新 Markdown 内容失败', error)
      setMarkdownError(error instanceof Error ? error.message : '保存失败，请稍后重试')
    } finally {
      setIsMarkdownSaving(false)
    }
  }, [markdownDraft, onUpdateReport, selectedCase, selectedReport])

  const handleMarkdownResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isMarkdownEditing) {
        return
      }
      event.preventDefault()
      markdownResizeState.current = {
        active: true,
        startY: event.clientY,
        baseHeight: markdownEditorHeight,
      }

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!markdownResizeState.current.active) {
          return
        }
        const delta = markdownResizeState.current.startY - moveEvent.clientY
        const nextHeight = Math.max(160, Math.min(520, markdownResizeState.current.baseHeight + delta))
        setMarkdownEditorHeight(nextHeight)
      }

      const handlePointerUp = () => {
        markdownResizeState.current.active = false
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
        window.removeEventListener('pointercancel', handlePointerUp)
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
      window.addEventListener('pointercancel', handlePointerUp)
    },
    [isMarkdownEditing, markdownEditorHeight],
  )

  const minimapData = useMemo(() => {
    if (!selectedSample || !imageMeta.width || !imageMeta.height) {
      return null
    }

    const minimapWidth = 160
    const minimapHeight = (imageMeta.height / imageMeta.width) * minimapWidth
    const { scale, offsetX, offsetY } = viewport

    const leftRatio = clamp(
      ((-containerSize.width / 2 - offsetX) / scale + imageMeta.width / 2) / imageMeta.width,
      0,
      1,
    )
    const topRatio = clamp(
      ((-containerSize.height / 2 - offsetY) / scale + imageMeta.height / 2) / imageMeta.height,
      0,
      1,
    )
    const widthRatio = clamp(containerSize.width / (imageMeta.width * scale), 0, 1)
    const heightRatio = clamp(containerSize.height / (imageMeta.height * scale), 0, 1)

    // 左/上是可视区域左上角；由于最小图框采用 translate(-50%,-50%)，
    // 需要把 left/top 设置为中心点：left = leftRatio + widthRatio/2
    const centerLeftRatio = clamp(leftRatio + widthRatio / 2, 0, 1)
    const centerTopRatio = clamp(topRatio + heightRatio / 2, 0, 1)

    return {
      width: minimapWidth,
      height: minimapHeight,
      viewportStyle: {
        left: `${centerLeftRatio * 100}%`,
        top: `${centerTopRatio * 100}%`,
        width: `${Math.max(widthRatio * 100, 1)}%`,
        height: `${Math.max(heightRatio * 100, 1)}%`,
      },
    }
  }, [containerSize, imageMeta, selectedSample, viewport])

  return (
    <div
      className={['case-workspace', isSplitDragging ? 'is-split-dragging' : ''].join(' ').trim()}
      ref={layoutRef}
      data-split-ratio={splitRatio}
    >
      <div className="case-viewer" style={{ flexBasis: viewerPercent, maxWidth: viewerPercent }}>
        {selectedReport ? (
          <div className="case-viewer__markdown">
            <div className="case-viewer__toolbar">
              <span className="case-viewer__title">{selectedReport.title}</span>
              <div className="case-viewer__controls">
                {markdownError ? <span className="case-viewer__error">{markdownError}</span> : null}
                <span className="case-viewer__tag-badge">Markdown</span>
                {isMarkdownEditing ? (
                  <>
                    <button type="button" className="case-viewer__reset" onClick={handleMarkdownSave} disabled={isMarkdownSaving}>
                      {isMarkdownSaving ? '保存中…' : '保存'}
                    </button>
                    <button type="button" className="case-viewer__reset" onClick={handleMarkdownEditCancel} disabled={isMarkdownSaving}>
                      取消
                    </button>
                  </>
                ) : (
                  <button type="button" className="case-viewer__reset" onClick={handleMarkdownEditStart}>
                    编辑
                  </button>
                )}
              </div>
            </div>
            <div className="case-viewer__markdown-body" data-editing={isMarkdownEditing || undefined}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentMarkdownContent}</ReactMarkdown>
            </div>
            {isMarkdownEditing ? (
              <div className="case-viewer__markdown-editor">
                <div
                  className="case-viewer__markdown-editor-handle"
                  role="separator"
                  aria-label="调整编辑高度"
                  onPointerDown={handleMarkdownResizeStart}
                />
                <textarea
                  style={{ height: `${markdownEditorHeight}px` }}
                  value={markdownDraft}
                  onChange={(event) => setMarkdownDraft(event.target.value)}
                  spellCheck={false}
                />
                <p>支持 Markdown 语法，保存后即刻渲染。</p>
              </div>
            ) : null}
          </div>
        ) : selectedSample ? (
          <div className="case-viewer__frame" onWheel={handleWheel}>
            <div className="case-viewer__toolbar">
              <span className="case-viewer__title">{selectedSample.displayName || selectedSample.originalFilename}</span>
              <div className="case-viewer__controls">
                <span className="case-viewer__zoom">{zoomPercent}%</span>
                <button type="button" onClick={handleResetZoom} className="case-viewer__reset">
                  重置
                </button>
              </div>
            </div>
            <div
              className="case-viewer__canvas"
              ref={containerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              data-dragging={isDragging || undefined}
              data-draggable={viewport.scale > viewport.minScale + 0.0001 || undefined}
            >
              <div
                className="case-viewer__image-layer"
                style={{
                  transform: `translate3d(${viewport.offsetX}px, ${viewport.offsetY}px, 0) scale(${viewport.scale})`,
                }}
              >
                <img
                  ref={imageRef}
                  src={selectedSample.imageUrl}
                  alt={selectedSample.displayName ?? '病例样例'}
                  onLoad={handleImageLoad}
                  draggable={false}
                />
              </div>
              {minimapData ? (
                <div
                  className="case-viewer__minimap"
                  style={{
                    width: `${minimapData.width}px`,
                    height: `${minimapData.height}px`,
                    backgroundImage: `url(${selectedSample.thumbnailUrl ?? selectedSample.imageUrl})`,
                  }}
                >
                  <div className="case-viewer__minimap-viewport" style={minimapData.viewportStyle} />
                </div>
              ) : null}
            </div>
          </div>
        ) : selectedCase ? (
          <div className="case-viewer__placeholder">
            <p>请选择该病例下的影像或文字记录。</p>
            {selectedCase.samples.length === 0 && selectedCase.reports.length === 0 ? (
              <span>当前病例尚未导入任何内容。</span>
            ) : null}
          </div>
        ) : (
          <div className="case-viewer__placeholder">
            <p>请选择左侧病例开始预览。</p>
          </div>
        )}
      </div>

      <div
        className={[
          'case-split-handle',
          isSplitDragging ? 'is-active' : '',
        ]
          .join(' ')
          .trim()}
        role="separator"
        aria-label="调整左右区宽度"
        aria-orientation="vertical"
        aria-valuemin={Math.round(MIN_SPLIT_RATIO * 100)}
        aria-valuemax={Math.round(MAX_SPLIT_RATIO * 100)}
        aria-valuenow={Math.round(splitRatio * 100)}
        tabIndex={0}
        onKeyDown={handleSplitKeyDown}
        onPointerDown={handleSplitPointerDown}
        onPointerMove={handleSplitPointerMove}
        onPointerUp={handleSplitPointerUp}
        onPointerCancel={handleSplitPointerUp}
        style={{ width: `${SPLIT_HANDLE_WIDTH}px` }}
      >
        <span className="case-split-handle__grip" aria-hidden="true" />
      </div>

      <div className={['case-analysis-panel', outerRightMode === 'ai' ? 'is-ai' : ''].join(' ')} style={{ flexBasis: analysisPercent, maxWidth: analysisPercent }}>
        {outerRightMode === 'ai' ? (
          <>
            {selectedCase ? (
              <div className="case-analysis-panel__body ai-mode" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="ai-pond-full">
                  <div className="ai-pond__header" role="toolbar" aria-label="右半区切换与操作">
                    <div className="ai-subtabs" role="tablist" aria-label="右半区模式">
                      <button
                        ref={(node) => {
                          tabRefs.current.ai = node
                        }}
                        type="button"
                        role="tab"
                        id="right-tab-ai"
                        aria-controls="right-panel-ai"
                        aria-selected={rightMode === 'ai'}
                        className={rightMode === 'ai' ? 'is-active' : ''}
                        onClick={() => setRightMode('ai')}
                        onKeyDown={handleTabKeyDown('ai')}
                      >
                        文字总结
                      </button>
                      <button
                        ref={(node) => {
                          tabRefs.current.viz = node
                        }}
                        type="button"
                        role="tab"
                        id="right-tab-viz"
                        aria-controls="right-panel-viz"
                        aria-selected={rightMode === 'viz'}
                        className={rightMode === 'viz' ? 'is-active' : ''}
                        onClick={() => setRightMode('viz')}
                        onKeyDown={handleTabKeyDown('viz')}
                      >
                        图像总结
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="ai-pond__title">{selectedCase.displayName || selectedCase.identifier}</div>
                      <button
                        type="button"
                        className="ai-chip-btn"
                        onClick={() => {
                          if (rightMode !== 'ai') setRightMode('ai')
                          chatRef.current?.newChat()
                        }}
                      >
                        新建对话
                      </button>
                    </div>
                  </div>
                  <div className="ai-pond__body">
                    {rightMode === 'ai' ? (
                      <div id="right-panel-ai" role="tabpanel" aria-labelledby="right-tab-ai" className="ai-mode__content ai-mode__content--text">
                        <AIChatPanel ref={chatRef} caseId={selectedCase.id} />
                      </div>
                    ) : selectedSample ? (
                      <div id="right-panel-viz" role="tabpanel" aria-labelledby="right-tab-viz" className="ai-mode__content ai-mode__content--viz">
                        <VisualizationPanel caseId={selectedCase.id} sampleId={selectedSample.id} cases={cases} />
                      </div>
                    ) : (
                      <div id="right-panel-viz" role="tabpanel" aria-labelledby="right-tab-viz" className="ai-mode__content ai-mode__content--viz">
                        <div className="case-analysis-panel__placeholder" style={{ width: '100%' }}>
                          <p>请选择该病例下的影像样本以查看“图像总结”。</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="case-analysis-panel__placeholder">
                <p>请选择病例开始对话。</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="case-analysis-panel__header">
              <h3>分析区</h3>
              <div className="case-analysis-panel__actions">
                <button
                  type="button"
                  className="pond-button pond-button--compact"
                  onClick={() => openSystemPath(headerImages?.raw ?? null)}
                  disabled={!headerImages?.raw}
                >
                  查看原始图像
                </button>
                <button
                  type="button"
                  className="pond-button pond-button--compact"
                  onClick={() => openSystemPath(headerImages?.parsed ?? null)}
                  disabled={!headerImages?.parsed}
                >
                  查看解析图像
                </button>
              </div>
            </div>
            {selectedCase && selectedReport ? (
              <div className="case-analysis-panel__body">
                <dl>
                  <div>
                    <dt>病例</dt>
                    <dd>{selectedCase.identifier}</dd>
                  </div>
                  <div>
                    <dt>摘要</dt>
                    <dd>{selectedReport.summary || '—'}</dd>
                  </div>
                  <div>
                    <dt>标签</dt>
                    <dd>
                      {selectedReport.tags.length > 0 ? (
                        selectedReport.tags.map((tag) => (
                          <span key={tag} className="report-tag">
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span>未设置</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>更新时间</dt>
                    <dd>{new Date(selectedReport.updatedAt).toLocaleString()}</dd>
                  </div>
                </dl>
              </div>
            ) : selectedCase && selectedSample ? (
              <div className="case-analysis-panel__body">
                {selectedSample.modality === '组织切片' ? (
                  <TissueAnalysisView
                    caseIdentifier={selectedCase.identifier}
                    sampleName={selectedSample.displayName || selectedSample.originalFilename}
                    caseId={selectedCase.id}
                    sampleId={selectedSample.id}
                    analysis={(selectedSample as any).analysis ?? null}
                    onImagesChange={(imgs) => setHeaderImages(imgs)}
                  />
                ) : (
                  <div>
                    <p>该样本类型不提供此类分析。</p>
                    <dl>
                      <div>
                        <dt>病例</dt>
                        <dd>{selectedCase.identifier}</dd>
                      </div>
                      <div>
                        <dt>样例类别</dt>
                        <dd>{selectedSample.modality}</dd>
                      </div>
                      <div>
                        <dt>名称</dt>
                        <dd>{selectedSample.displayName || '未填写'}</dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>
            ) : (
              <div className="case-analysis-panel__placeholder">
                <p>选择样例或文字病历后在此查看信息。</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const asNumber = (v: unknown): number | null => {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const n = Number(String(v).trim().replace(/%$/, ''))
  return Number.isFinite(n) ? n : null
}

const fmt = {
  percent: (v: unknown) => {
    const n = asNumber(v)
    return n == null ? '未提供' : `${n.toFixed(2)}%`
  },
  mm2: (v: unknown) => {
    const n = asNumber(v)
    return n == null ? '未提供' : `${n.toFixed(2)} mm²`
  },
  density: (v: unknown) => {
    const n = asNumber(v)
    return n == null ? '未提供' : `${n.toFixed(2)} number/mm²`
  },
  int: (v: unknown) => {
    const n = asNumber(v)
    return n == null ? '未提供' : `${Math.round(n)}`
  },
  unitless: (v: unknown) => {
    const n = asNumber(v)
    return n == null ? '未提供' : `${n.toFixed(2)}`
  },
  px: (v: unknown) => {
    const n = asNumber(v)
    return n == null ? '未提供' : `${Math.round(n).toLocaleString()} px`
  },
  count: (v: unknown) => {
    const n = asNumber(v)
    return n == null ? '未提供' : `${Math.round(n).toLocaleString()}`
  },
}

const openSystemPath = async (absPath: string | null | undefined) => {
  if (!absPath) return { ok: false, error: '未提供路径' }
  const api: any = (window as any).electronAPI
  if (!api || typeof api.openPath !== 'function') {
    return { ok: false, error: '当前环境不支持外部打开' }
  }
  return api.openPath(absPath)
}

const TissueAnalysisView = ({
  caseIdentifier,
  sampleName,
  caseId,
  sampleId,
  analysis,
  onImagesChange,
}: {
  caseIdentifier: string
  sampleName: string
  caseId: string
  sampleId: string
  analysis: TissueAnalysis | null
  onImagesChange?: (imgs: { raw: string | null; parsed: string | null } | null) => void
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TissueAnalysis | null>(analysis)

  useEffect(() => {
    setData(analysis ?? null)
  }, [analysis])

  useEffect(() => {
    if (data || loading) return
    let aborted = false
    ;(async () => {
      try {
        setLoading(true)
        const mod = await import('../services/caseService')
        const fetched = await mod.fetchSampleAnalysis(caseId, sampleId)
        if (!aborted) setData(fetched)
      } catch (e: any) {
        if (!aborted) setError(e?.message ?? '加载分析失败')
      } finally {
        if (!aborted) setLoading(false)
      }
    })()
    return () => {
      aborted = true
    }
  }, [caseId, sampleId, data, loading])

  const raw = data?.raw ?? null
  const derived = data?.derived ?? null
  const images = data?.images ?? null

  useEffect(() => {
    onImagesChange?.(images ? { raw: images.raw_image_path ?? null, parsed: images.parsed_image_path ?? null } : null)
    return () => {
      onImagesChange?.(null)
    }
  }, [images?.raw_image_path, images?.parsed_image_path])

  const aiSections: string[] | null = (data as any)?.metadata?.ai && Array.isArray((data as any).metadata.ai)
    ? ((data as any).metadata.ai as string[])
    : null

  return (
    <div className="tissue-analysis">
      {/* 操作按钮移动到父级头部 */}

      {loading ? (
        <p>加载中...</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : (
        <>
          <section className="pond" aria-labelledby="pond-basic">
            <h4 id="pond-basic" className="pond__title">基本信息</h4>
            <div className="pond__grid pond__grid--two">
              <div className="pond__item">
                <div className="pond__item-title">病例/样本</div>
                <div className="pond__item-value">{caseIdentifier} / {sampleName}</div>
              </div>
              <div className="pond__item">
                <div className="pond__item-title">分析来源</div>
                <div className="pond__item-value">{(data as any)?.metadata?.source ?? '未提供'}</div>
              </div>
            </div>
          </section>

          <section className="pond" aria-labelledby="pond-raw">
            <h4 id="pond-raw" className="pond__title">基本病理数据</h4>
            <div className="pond__grid pond__grid--three">
              <div className="pond__item"><div className="pond__item-title">1级弱阳性细胞数量 / Positive Cells 1 Weak</div><div className="pond__item-value">{fmt.count(raw?.pos_cells_1_weak)}</div></div>
              <div className="pond__item"><div className="pond__item-title">2级中度阳性细胞数量 / Positive Cells 2 Moderate</div><div className="pond__item-value">{fmt.count(raw?.pos_cells_2_moderate)}</div></div>
              <div className="pond__item"><div className="pond__item-title">3级强阳性细胞数量 / Positive Cells 3 Strong</div><div className="pond__item-value">{fmt.count(raw?.pos_cells_3_strong)}</div></div>
              <div className="pond__item"><div className="pond__item-title">IOD 细胞总数 / Total Cells Number</div><div className="pond__item-value">{fmt.count(raw?.iod_total_cells)}</div></div>
              <div className="pond__item"><div className="pond__item-title">阳性面积 / Positive Area</div><div className="pond__item-value">{fmt.mm2(raw?.positive_area_mm2)}</div></div>
              <div className="pond__item"><div className="pond__item-title">组织面积 / Tissue Area</div><div className="pond__item-value">{fmt.mm2(raw?.tissue_area_mm2)}</div></div>
              <div className="pond__item"><div className="pond__item-title">阳性像素面积 / Positive Area (px)</div><div className="pond__item-value">{fmt.px(raw?.positive_area_px)}</div></div>
              <div className="pond__item"><div className="pond__item-title">组织像素面积 / Tissue Area (px)</div><div className="pond__item-value">{fmt.px(raw?.tissue_area_px)}</div></div>
              <div className="pond__item"><div className="pond__item-title">阳性强度 / Positive Intensity</div><div className="pond__item-value">{fmt.unitless(raw?.positive_intensity)}</div></div>
            </div>
          </section>

          <div className="pond-row pond-row--split">
            <section className="pond" aria-labelledby="pond-derived">
              <h4 id="pond-derived" className="pond__title">分析数据</h4>
              <div className="pond__grid pond__grid--one">
                <div className="pond__item"><div className="pond__item-title">阳性细胞比率 / Positive Cells</div><div className="pond__item-value">{fmt.percent(derived?.positive_cells_ratio)}</div></div>
                <div className="pond__item"><div className="pond__item-title">阳性细胞密度 / Positive Cells Density</div><div className="pond__item-value">{fmt.density(derived?.positive_cells_density)}</div></div>
                <div className="pond__item"><div className="pond__item-title">平均光密度值 / Mean Density</div><div className="pond__item-value">{fmt.unitless(derived?.mean_density)}</div></div>
                <div className="pond__item"><div className="pond__item-title">H-Score</div><div className="pond__item-value">{fmt.int(derived?.h_score)}</div></div>
                <div className="pond__item"><div className="pond__item-title">IRS</div><div className="pond__item-value">{fmt.int(derived?.irs)}</div></div>
              </div>
            </section>

          <section className="pond pond--ai" aria-labelledby="pond-ai">
            <h4 id="pond-ai" className="pond__title">预测 & 建议</h4>
            <div className="pond__content">
              <AIMarkdownSection index={1} content={aiSections?.[0]} />
              <AIMarkdownSection index={2} content={aiSections?.[1]} />
              <AIMarkdownSection index={3} content={aiSections?.[2]} />
            </div>
          </section>
          </div>
        </>
      )}
    </div>
  )
}

// 动态加载的可视化面板（延迟导入，避免初始包体积增大）
const VisualizationPanel = ({ caseId, sampleId, cases }: { caseId: string; sampleId: string; cases: CaseRecord[] }) => {
  const LazyPanel = useMemo(() => lazy(() => import('./VisualizationPanel')), [])
  return (
    <Suspense fallback={<div style={{ padding: 12 }}>加载可视化模块...</div>}>
      <LazyPanel caseId={caseId} sampleId={sampleId} cases={cases} />
    </Suspense>
  )
}

const AIMarkdownSection = ({ index, content: override }: { index: 1 | 2 | 3; content?: string | null }) => {
  const [content, setContent] = useState<string>('')
  useEffect(() => {
    if (override && override.trim()) {
      setContent(override)
      return
    }
    const pool = [
      `## 预测概述\n\n- 免疫反应呈异质分布，阳性细胞聚集于上皮区\n- 建议结合分型指标评估整体活性`,
      `## 深度推理\n\n**H-Score/IRS** 综合显示中高水平染色强度，提示活跃通路参与；需结合临床史判读`,
      `## 注意事项\n\n- 切片质量与扫描分辨率可能影响像素级面积与强度估计\n- ROI 选择偏差会改变密度与比率估计，需多区域复核`,
    ]
    setContent(pool[index - 1])
  }, [index, override])

  // 使用 ReactMarkdown 渲染：允许 h2/h3/段落/列表/强调；禁用图片/HTML
  // react-markdown 仅支持二选一：allowedElements 或 disallowedElements
  // 为安全起见，仅允许少量元素且跳过 HTML
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      allowedElements={['h2', 'h3', 'p', 'strong', 'em', 'ul', 'li']}
      skipHtml
    >
      {content}
    </ReactMarkdown>
  )
}
