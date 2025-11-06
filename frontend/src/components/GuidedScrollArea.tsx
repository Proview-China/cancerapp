import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import './GuidedScrollArea.css'

type GuidedScrollAreaProps = {
  children: ReactNode
  className?: string
}

type ScrollMetrics = {
  contentHeight: number
  viewportHeight: number
  scrollTop: number
}

const INITIAL_METRICS: ScrollMetrics = {
  contentHeight: 0,
  viewportHeight: 0,
  scrollTop: 0,
}

export const GuidedScrollArea = ({ children, className }: GuidedScrollAreaProps) => {
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragPointerRef = useRef<number | null>(null)
  const dragOriginRef = useRef<{ clientY: number; scrollTop: number }>({ clientY: 0, scrollTop: 0 })
  const [metrics, setMetrics] = useState<ScrollMetrics>(INITIAL_METRICS)
  const [isHovering, setIsHovering] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const maxScrollTop = useMemo(
    () => Math.max(metrics.contentHeight - metrics.viewportHeight, 0),
    [metrics.contentHeight, metrics.viewportHeight],
  )

  const thumb = useMemo(() => {
    if (metrics.viewportHeight <= 0 || metrics.contentHeight <= metrics.viewportHeight + 1) {
      return { height: 0, offset: 0 }
    }

    const trackLength = metrics.viewportHeight
    const height = Math.max(Math.floor((metrics.viewportHeight / metrics.contentHeight) * trackLength), 56)
    const available = Math.max(trackLength - height, 1)
    const ratio = metrics.scrollTop / maxScrollTop
    const offset = Math.min(Math.max(ratio * available, 0), available)

    return { height, offset }
  }, [maxScrollTop, metrics.contentHeight, metrics.scrollTop, metrics.viewportHeight])

  const updateMetrics = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    setMetrics({
      contentHeight: viewport.scrollHeight,
      viewportHeight: viewport.clientHeight,
      scrollTop: viewport.scrollTop,
    })
  }, [])

  const handleScroll = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    setMetrics((current) => {
      if (
        current.contentHeight === viewport.scrollHeight &&
        current.viewportHeight === viewport.clientHeight &&
        current.scrollTop === viewport.scrollTop
      ) {
        return current
      }

      return {
        contentHeight: viewport.scrollHeight,
        viewportHeight: viewport.clientHeight,
        scrollTop: viewport.scrollTop,
      }
    })
  }, [])

  const handleTrackPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const viewport = viewportRef.current
      const track = trackRef.current
      if (!viewport || !track || metrics.contentHeight <= metrics.viewportHeight) {
        return
      }

      const rect = track.getBoundingClientRect()
      const clickRatio = (event.clientY - rect.top) / rect.height
      const targetScroll = Math.min(Math.max(clickRatio * maxScrollTop, 0), maxScrollTop)

      viewport.scrollTo({ top: targetScroll, behavior: 'smooth' })
    },
    [maxScrollTop, metrics.contentHeight, metrics.viewportHeight],
  )

  const handleThumbPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    dragPointerRef.current = event.pointerId
    dragOriginRef.current = { clientY: event.clientY, scrollTop: viewport.scrollTop }
    setIsDragging(true)
    viewport.style.scrollBehavior = 'auto'
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const handleThumbPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || dragPointerRef.current !== event.pointerId) {
        return
      }

      const viewport = viewportRef.current
      const track = trackRef.current
      if (!viewport || !track) {
        return
      }

      const rect = track.getBoundingClientRect()
      const available = Math.max(rect.height - thumb.height, 1)
      const deltaRatio = (event.clientY - dragOriginRef.current.clientY) / available
      const nextScroll = Math.min(
        Math.max(dragOriginRef.current.scrollTop + deltaRatio * maxScrollTop, 0),
        maxScrollTop,
      )

      viewport.scrollTop = nextScroll
    },
    [isDragging, maxScrollTop, thumb.height],
  )

  const handleThumbPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragPointerRef.current !== event.pointerId) {
        return
      }

      dragPointerRef.current = null
      setIsDragging(false)
      const viewport = viewportRef.current
      if (viewport) {
        viewport.style.scrollBehavior = ''
      }
      event.currentTarget.releasePointerCapture(event.pointerId)
    },
    [],
  )

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    updateMetrics()

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateMetrics())
      : undefined

    if (resizeObserver) {
      resizeObserver.observe(viewport)
      Array.from(viewport.children).forEach((child) => resizeObserver.observe(child as Element))
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', updateMetrics)

    return () => {
      viewport.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', updateMetrics)
      resizeObserver?.disconnect()
    }
  }, [handleScroll, updateMetrics])

  useEffect(() => {
    if (!isDragging) {
      return
    }

    const handleMove = (event: PointerEvent) => {
      if (dragPointerRef.current !== event.pointerId) {
        return
      }
      const viewport = viewportRef.current
      const track = trackRef.current
      if (!viewport || !track) {
        return
      }

      const rect = track.getBoundingClientRect()
      const available = Math.max(rect.height - thumb.height, 1)
      const deltaRatio = (event.clientY - dragOriginRef.current.clientY) / available
      const nextScroll = Math.min(
        Math.max(dragOriginRef.current.scrollTop + deltaRatio * maxScrollTop, 0),
        maxScrollTop,
      )

      viewport.scrollTop = nextScroll
    }

    const handleUp = (event: PointerEvent) => {
      if (dragPointerRef.current !== event.pointerId) {
        return
      }
      dragPointerRef.current = null
      setIsDragging(false)
      const viewport = viewportRef.current
      if (viewport) {
        viewport.style.scrollBehavior = ''
      }
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)

    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [isDragging, maxScrollTop, thumb.height])

  const hasScroll = metrics.contentHeight > metrics.viewportHeight + 1

  return (
    <div className="scroll-guide" onPointerLeave={() => setIsHovering(false)}>
      <div
        ref={viewportRef}
        className={[className ?? '', 'scroll-guide__viewport'].join(' ').trim()}
        onPointerEnter={() => setIsHovering(true)}
      >
        {children}
      </div>

      {hasScroll ? (
        <div
          ref={trackRef}
          className={['scrollbar-track', isHovering || isDragging ? 'is-visible' : ''].join(' ').trim()}
          role="presentation"
          onPointerDown={handleTrackPointerDown}
        >
          <div
            className={['scrollbar-thumb', isDragging ? 'is-dragging' : ''].join(' ').trim()}
            role="scrollbar"
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={maxScrollTop}
            aria-valuenow={metrics.scrollTop}
            style={{
              height: `${thumb.height}px`,
              transform: `translateY(${thumb.offset}px)`
            }}
            onPointerDown={handleThumbPointerDown}
            onPointerMove={handleThumbPointerMove}
            onPointerUp={handleThumbPointerUp}
            onPointerCancel={handleThumbPointerUp}
          >
            <span className="scrollbar-thumb__inner" aria-hidden />
          </div>
        </div>
      ) : null}
    </div>
  )
}
