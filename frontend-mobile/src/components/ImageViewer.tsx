import { useEffect, useMemo, useRef, useState } from 'react'
import type { CaseSample } from '../types/cases'

const MAX_SCALE = 6

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

type Props = {
  sample: CaseSample
}

type Size = { width: number; height: number }

type Viewport = { scale: number; offsetX: number; offsetY: number; minScale: number }

type PointerState = { x: number; y: number }

const ImageViewer = ({ sample }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState<Size>({ width: 0, height: 0 })
  const [imageSize, setImageSize] = useState<Size>({ width: 0, height: 0 })
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, minScale: 1, offsetX: 0, offsetY: 0 })
  const pointers = useRef<Map<number, PointerState>>(new Map())
  const pinchBase = useRef<{ scale: number; offsetX: number; offsetY: number; distance: number; focusX: number; focusY: number } | null>(null)
  const panBase = useRef<{ offsetX: number; offsetY: number; startX: number; startY: number } | null>(null)
  const lastTap = useRef<number>(0)

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    // reset when sample changes
    setViewport({ scale: 1, minScale: 1, offsetX: 0, offsetY: 0 })
  }, [sample.id])

  const fitScale = useMemo(() => {
    if (!imageSize.width || !imageSize.height || !containerSize.width || !containerSize.height) return 1
    return Math.min(containerSize.width / imageSize.width, containerSize.height / imageSize.height, 1)
  }, [containerSize, imageSize])

  useEffect(() => {
    setViewport((prev) => ({ ...prev, scale: fitScale, minScale: fitScale, offsetX: 0, offsetY: 0 }))
  }, [fitScale, sample.id])

  const clampOffsets = (scale: number, offsetX: number, offsetY: number) => {
    const imgW = imageSize.width * scale
    const imgH = imageSize.height * scale
    const maxX = Math.max((imgW - containerSize.width) / 2, 0)
    const maxY = Math.max((imgH - containerSize.height) / 2, 0)
    return {
      offsetX: clamp(offsetX, -maxX, maxX),
      offsetY: clamp(offsetY, -maxY, maxY),
    }
  }

  const updateFromPointers = () => {
    if (pointers.current.size === 0) return
    const entries = Array.from(pointers.current.values())
    if (entries.length === 1 && panBase.current) {
      const { startX, startY, offsetX, offsetY } = panBase.current
      const current = entries[0]
      const next = clampOffsets(viewport.scale, offsetX + (current.x - startX), offsetY + (current.y - startY))
      setViewport((prev) => ({ ...prev, ...next }))
    }
    if (entries.length === 2 && pinchBase.current) {
      const [p1, p2] = entries
      const dx = p1.x - p2.x
      const dy = p1.y - p2.y
      const distance = Math.hypot(dx, dy)
      const { scale, offsetX, offsetY, distance: baseDistance, focusX, focusY } = pinchBase.current
      const nextScale = clamp(scale * (distance / baseDistance), viewport.minScale, MAX_SCALE)
      const scaleRatio = nextScale / scale
      const nextOffsetX = (offsetX + focusX) * scaleRatio - focusX
      const nextOffsetY = (offsetY + focusY) * scaleRatio - focusY
      const clamped = clampOffsets(nextScale, nextOffsetX, nextOffsetY)
      setViewport((prev) => ({ ...prev, scale: nextScale, offsetX: clamped.offsetX, offsetY: clamped.offsetY }))
    }
  }

  const handlePointerDown = (event: React.PointerEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const point = { x: event.clientX - (rect.left + rect.width / 2), y: event.clientY - (rect.top + rect.height / 2) }
    const map = pointers.current
    map.set(event.pointerId, point)
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)

    if (map.size === 1) {
      panBase.current = { offsetX: viewport.offsetX, offsetY: viewport.offsetY, startX: point.x, startY: point.y }
    }
    if (map.size === 2) {
      const vals = Array.from(map.values())
      const dx = vals[0].x - vals[1].x
      const dy = vals[0].y - vals[1].y
      const distance = Math.hypot(dx, dy)
      const focusX = (vals[0].x + vals[1].x) / 2
      const focusY = (vals[0].y + vals[1].y) / 2
      pinchBase.current = {
        scale: viewport.scale,
        offsetX: viewport.offsetX,
        offsetY: viewport.offsetY,
        distance,
        focusX,
        focusY,
      }
    }
  }

  const handlePointerMove = (event: React.PointerEvent) => {
    const map = pointers.current
    if (!map.has(event.pointerId)) return
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const point = { x: event.clientX - (rect.left + rect.width / 2), y: event.clientY - (rect.top + rect.height / 2) }
    map.set(event.pointerId, point)
    updateFromPointers()
  }

  const handlePointerUp = (event: React.PointerEvent) => {
    const map = pointers.current
    map.delete(event.pointerId)
    if (map.size < 2) {
      pinchBase.current = null
    }
    if (map.size === 0) {
      panBase.current = null
    }
  }

  const resetView = () => {
    setViewport({ scale: fitScale, minScale: fitScale, offsetX: 0, offsetY: 0 })
    pointers.current.clear()
    pinchBase.current = null
    panBase.current = null
  }

  const handleDoubleTap = () => {
    const now = Date.now()
    if (now - lastTap.current < 320) {
      resetView()
    }
    lastTap.current = now
  }

  const style = {
    transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`,
  }

  return (
    <div className="viewer-shell" ref={containerRef} onDoubleClick={handleDoubleTap}>
      <div
        className="viewer-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="viewer-layer" style={style}>
          <img
            src={sample.imageUrl}
            alt={sample.displayName || sample.originalFilename}
            onLoad={(e) => {
              const target = e.currentTarget
              setImageSize({ width: target.naturalWidth, height: target.naturalHeight })
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default ImageViewer
