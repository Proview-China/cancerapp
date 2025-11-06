import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { CaseRecord } from '../types/cases'
import './CasesWorkspace.css'

type CasesWorkspaceProps = {
  cases: CaseRecord[]
  selectedCaseId: string | null
  selectedSampleId: string | null
  selectedReportId: string | null
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const MAX_SCALE = 20

type ViewportState = {
  scale: number
  minScale: number
  offsetX: number
  offsetY: number
}

export const CasesWorkspace = ({ cases, selectedCaseId, selectedSampleId, selectedReportId }: CasesWorkspaceProps) => {
  const [viewport, setViewport] = useState<ViewportState>({ scale: 1, minScale: 1, offsetX: 0, offsetY: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [imageMeta, setImageMeta] = useState({ width: 0, height: 0 })
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const viewportRef = useRef(viewport)
  const dragStateRef = useRef({
    active: false,
    pointerId: 0,
    startX: 0,
    startY: 0,
    baseOffsetX: 0,
    baseOffsetY: 0,
  })

  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

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
    setImageMeta({ width: 0, height: 0 })
    setViewport((prev) => ({ ...prev, offsetX: 0, offsetY: 0 }))
  }, [selectedSampleId])

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

  const handleResetZoom = useCallback(() => {
    const { minScale } = viewportRef.current
    setViewport({ scale: minScale, minScale, offsetX: 0, offsetY: 0 })
  }, [])

  const zoomPercent = Math.round(viewport.scale * 100)

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

    return {
      width: minimapWidth,
      height: minimapHeight,
      viewportStyle: {
        left: `${leftRatio * 100}%`,
        top: `${topRatio * 100}%`,
        width: `${widthRatio * 100}%`,
        height: `${heightRatio * 100}%`,
      },
    }
  }, [containerSize, imageMeta, selectedSample, viewport])

  return (
    <div className="case-workspace">
      <div className="case-viewer">
        {selectedReport ? (
          <div className="case-viewer__markdown">
            <div className="case-viewer__toolbar">
              <span className="case-viewer__title">{selectedReport.title}</span>
              <div className="case-viewer__controls">
                <span className="case-viewer__tag-badge">Markdown</span>
              </div>
            </div>
            <div className="case-viewer__markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedReport.content}</ReactMarkdown>
            </div>
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

      <div className="case-analysis-panel">
        <h3>分析区</h3>
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
            <p>后续在此区域展示分析结果与工具。</p>
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
        ) : (
          <div className="case-analysis-panel__placeholder">
            <p>选择样例或文字病历后在此查看信息。</p>
          </div>
        )}
      </div>
    </div>
  )
}
