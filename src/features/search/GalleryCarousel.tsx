import { useState, useEffect, useRef } from 'react'
import { getFileUrl } from '../../api/search'
import type { FileMetadata } from '../../api/types'
import { SERVICE_TYPE } from '../../api/types'
import { useRatingServicesStore } from '../../stores/rating-services-store'
import { useSettingsStore } from '../../stores/settings-store'
import { setRating } from '../../api/ratings'
import { useMobile } from '../../hooks/use-mobile'
import { FileRenderer } from '../../components/FileRenderer'

interface Props {
  files: FileMetadata[]
  initialIndex: number
  onClose: (index?: number) => void
  hasMore?: boolean
  onRequestMore?: () => void
  onRatingChange?: (hash: string) => void | Promise<void>
  sortByRating?: boolean
}

export function GalleryCarousel({ files, initialIndex, onClose, hasMore, onRequestMore, onRatingChange, sortByRating }: Props) {
  const isMobile = useMobile()
  const carouselFloatingPanel = useSettingsStore((s) => s.carouselFloatingPanel)
  const carouselNavSide = useSettingsStore((s) => s.carouselNavSide)
  const [index, setIndex] = useState(initialIndex)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showInfo, setShowInfo] = useState(false)
  const [error, setError] = useState(false)
  const prevUrlRef = useRef<string | null>(null)
  const loadingMoreRef = useRef(false)
  const onRequestMoreRef = useRef(onRequestMore)
  const hasMoreRef = useRef(hasMore)
  const onRatingChangeRef = useRef(onRatingChange)
  onRequestMoreRef.current = onRequestMore
  hasMoreRef.current = hasMore
  onRatingChangeRef.current = onRatingChange

  const urlCacheRef = useRef<Map<string, string>>(new Map())
  const prefetchingRef = useRef<Set<string>>(new Set())
  const slideTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const navigatingRef = useRef(false)
  const initDoneRef = useRef(false)
  const [slideOutUrl, setSlideOutUrl] = useState<string | null>(null)
  const [slideDir, setSlideDir] = useState<1 | -1 | null>(null)
  const [sliding, setSliding] = useState(false)

  const file = files[index]
  const hashRef = useRef(file?.hash)
  hashRef.current = file?.hash
  const likeKeyRef = useRef<string | undefined>(undefined)
  const configuredLikeKey = useSettingsStore.getState().likeServiceKey
  const services = useRatingServicesStore.getState().services
  likeKeyRef.current = configuredLikeKey || services.find((s) => s.type === SERVICE_TYPE.LIKE_DISLIKE_RATING)?.service_key
  const likeValRef = useRef<boolean | null>(null)
  likeValRef.current = likeKeyRef.current && file?.ratings?.[likeKeyRef.current] != null
    ? file.ratings[likeKeyRef.current] as boolean
    : null

  const hasPrev = index > 0
  const hasNext = index < files.length - 1 || !!hasMore

  const goNextRef = useRef<() => void>(() => {})
  const goPrevRef = useRef<() => void>(() => {})

  useEffect(() => {
    loadingMoreRef.current = false
  }, [files.length])

  useEffect(() => {
    if (index >= files.length - 1 && hasMoreRef.current && !loadingMoreRef.current) {
      loadingMoreRef.current = true
      onRequestMoreRef.current?.()
    }
  }, [index, files.length])

  function cachedFetch(hash: string): Promise<string> {
    const cached = urlCacheRef.current.get(hash)
    if (cached) return Promise.resolve(cached)
    if (prefetchingRef.current.has(hash)) {
      return new Promise((resolve) => {
        const check = setInterval(() => {
          const c = urlCacheRef.current.get(hash)
          if (c) { clearInterval(check); resolve(c) }
        }, 30)
      })
    }
    prefetchingRef.current.add(hash)
    return getFileUrl(hash).then((url) => {
      urlCacheRef.current.set(hash, url)
      return url
    })
  }

  function prefetchNeighbors(idx: number) {
    for (const offset of [-2, -1, 1, 2]) {
      const i = idx + offset
      if (i < 0 || i >= files.length) continue
      const f = files[i]
      if (!f || urlCacheRef.current.has(f.hash) || prefetchingRef.current.has(f.hash)) continue
      prefetchingRef.current.add(f.hash)
      getFileUrl(f.hash).then((url) => urlCacheRef.current.set(f.hash, url)).catch(() => {})
    }
  }

  async function loadImage(idx: number, outgoing: string | null, dir: 1 | -1 | null) {
    const f = files[idx]
    if (!f) { navigatingRef.current = false; return }
    setError(false)
    setLoading(!outgoing)
    try {
      const url = await cachedFetch(f.hash)
      if (outgoing) {
        setSlideOutUrl(outgoing)
        setSlideDir(dir)
      }
      setImageUrl(url)
      prevUrlRef.current = url
      setLoading(false)
      prefetchNeighbors(idx)
      if (outgoing) {
        requestAnimationFrame(() => requestAnimationFrame(() => setSliding(true)))
        clearTimeout(slideTimerRef.current)
        slideTimerRef.current = setTimeout(() => {
          setSlideOutUrl(null)
          setSlideDir(null)
          setSliding(false)
          navigatingRef.current = false
        }, 300)
      } else {
        navigatingRef.current = false
      }
    } catch {
      setError(true)
      setLoading(false)
      navigatingRef.current = false
    }
  }

  useEffect(() => {
    if (initDoneRef.current) return
    initDoneRef.current = true
    loadImage(initialIndex, null, null)
  }, [])

  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current)
      for (const url of urlCacheRef.current.values()) URL.revokeObjectURL(url)
    }
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      switch (e.key) {
        case 'Escape':
          onClose(index)
          break
        case 'a':
        case 'ArrowLeft':
        case 'k':
          e.preventDefault()
          goPrevRef.current()
          break
        case 'd':
        case 'ArrowRight':
        case 'j':
          e.preventDefault()
          goNextRef.current()
          break
        case 'Home':
          e.preventDefault()
          setIndex(0)
          break
        case 'End':
          e.preventDefault()
          setIndex(files.length - 1)
          break
        case 'w':
          e.preventDefault()
          {
            const hash = hashRef.current
            const key = likeKeyRef.current
            if (!hash || !key) break
            const cur = likeValRef.current
            setRating({ hash, rating_service_key: key, rating: cur === true ? null : true })
              .then(() => onRatingChangeRef.current?.(hash))
          }
          break
        case 'i':
          setShowInfo((prev) => !prev)
          break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const [zoomScale, setZoomScale] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [isZoomed, setIsZoomed] = useState(false)
  const [panelVisible, setPanelVisible] = useState(true)
  const imageContainerRef = useRef<HTMLDivElement>(null)

  const touchRef = useRef({ startX: 0, startY: 0, lastTap: 0, pinching: false, pinchDist: 0, scale: 1, panX: 0, panY: 0, moved: false, wasZoomed: false })
  const zoomRef = useRef({ scale: 1, panX: 0, panY: 0 })

  function applyTransform() {
    const el = imageContainerRef.current
    if (!el) return
    const { scale, panX, panY } = zoomRef.current
    el.style.transform = `scale(${scale}) translate(${panX}px, ${panY}px)`
  }

  function syncZoomState() {
    const { scale, panX, panY } = zoomRef.current
    setZoomScale(scale)
    setPanX(panX)
    setPanY(panY)
    setIsZoomed(scale > 1)
  }

  function goNext() {
    if (navigatingRef.current) return
    if (index < files.length - 1) {
      navigatingRef.current = true
      const nextIdx = index + 1
      loadImage(nextIdx, imageUrl, 1)
      setIndex(nextIdx)
      resetZoom()
    } else if (hasMoreRef.current && !loadingMoreRef.current) {
      loadingMoreRef.current = true
      onRequestMoreRef.current?.()
    }
  }
  function goPrev() {
    if (navigatingRef.current) return
    if (index > 0) {
      navigatingRef.current = true
      const prevIdx = index - 1
      loadImage(prevIdx, imageUrl, -1)
      setIndex(prevIdx)
      resetZoom()
    }
  }
  goNextRef.current = goNext
  goPrevRef.current = goPrev

  function handleTouchStart(e: React.TouchEvent) {
    const t = touchRef.current
    t.moved = false
    t.wasZoomed = zoomRef.current.scale > 1
    const el = imageContainerRef.current
    if (el) el.style.transition = 'none'
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      t.pinching = true
      t.pinchDist = Math.sqrt(dx * dx + dy * dy)
      t.scale = zoomRef.current.scale
    } else if (e.touches.length === 1) {
      t.pinching = false
      t.startX = e.touches[0].clientX
      t.startY = e.touches[0].clientY
      t.panX = zoomRef.current.panX
      t.panY = zoomRef.current.panY
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    const t = touchRef.current
    if (t.pinching && e.touches.length === 2) {
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      let newScale = t.scale * (dist / t.pinchDist)
      newScale = Math.max(1, Math.min(newScale, 8))
      const oldScale = zoomRef.current.scale
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const invDelta = 1 / newScale - 1 / oldScale
      zoomRef.current.scale = newScale
      zoomRef.current.panX += mx * invDelta
      zoomRef.current.panY += my * invDelta
      t.scale = newScale
      t.pinchDist = dist
      t.moved = true
      applyTransform()
    } else if (e.touches.length === 1 && zoomRef.current.scale > 1) {
      e.preventDefault()
      const scale = zoomRef.current.scale
      const ddx = (e.touches[0].clientX - t.startX) / scale
      const ddy = (e.touches[0].clientY - t.startY) / scale
      zoomRef.current.panX = t.panX + ddx
      zoomRef.current.panY = t.panY + ddy
      t.moved = true
      applyTransform()
    } else if (e.touches.length === 1) {
      const dx = Math.abs(e.touches[0].clientX - t.startX)
      const dy = Math.abs(e.touches[0].clientY - t.startY)
      if (dx > 10 || dy > 10) t.moved = true
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const t = touchRef.current
    const el = imageContainerRef.current
    if (el) el.style.transition = ''
    if (e.changedTouches.length === 1) {
      if (t.moved && zoomRef.current.scale > 1) {
        syncZoomState()
        return
      }
      if (t.moved) {
        const dx = e.changedTouches[0].clientX - t.startX
        const dy = e.changedTouches[0].clientY - t.startY
        if (zoomRef.current.scale <= 1) {
          if (Math.abs(dy) > Math.abs(dx) && dy < -50 && carouselFloatingPanel) {
            setPanelVisible((v) => !v)
          } else if (Math.abs(dy) > Math.abs(dx) && dy > 50) {
            onClose(index)
          } else if (Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) > 50) {
            if (dx > 50) goPrev()
            else goNext()
          }
        }
        return
      }
      const now = Date.now()
      if (now - t.lastTap < 300) {
        zoomRef.current.scale = zoomRef.current.scale > 1 ? 1 : 2.5
        zoomRef.current.panX = 0
        zoomRef.current.panY = 0
        syncZoomState()
        if (el) {
          el.style.transition = 'transform 0.2s'
          applyTransform()
        }
      }
      t.lastTap = now
    }
    if (e.touches.length === 0) {
      t.pinching = false
      if (t.moved && zoomRef.current.scale <= 1) syncZoomState()
    }
  }

  function resetZoom() {
    zoomRef.current.scale = 1
    zoomRef.current.panX = 0
    zoomRef.current.panY = 0
    syncZoomState()
  }

  useEffect(() => {
    resetZoom()
  }, [file?.hash])

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => onClose(index)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'none' }}>
      <div className="flex items-center justify-between px-4 py-2" onClick={(e) => e.stopPropagation()}>
        <span className="text-white/70 text-sm">{index + 1} / {files.length}</span>
        {(() => {
          const configuredKey = useSettingsStore.getState().ratingServiceKey
          const services = useRatingServicesStore.getState().services
          const key = configuredKey || services.find((s) => s.type === SERVICE_TYPE.INC_DEC_RATING)?.service_key
          if (!key) return null
          const elo = file?.ratings?.[key]
          if (elo == null || typeof elo !== 'number') return null
          const rank = sortByRating ? index + 1 : 0
          const rankSuffix = rank % 10 === 1 && rank % 100 !== 11 ? 'st' : rank % 10 === 2 && rank % 100 !== 12 ? 'nd' : rank % 10 === 3 && rank % 100 !== 13 ? 'rd' : 'th'
          const rankColor = rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-600' : ''
          return <span className={`text-sm ml-3 ${rankColor}`}>{sortByRating && rank > 0 ? `${rank}${rankSuffix} · ` : ''}{elo} ELO</span>
        })()}
        {(() => {
          const key = likeKeyRef.current
          if (!key) return null
          const raw = file?.ratings?.[key]
          const val = raw != null && typeof raw === 'boolean' ? raw : null
          const color = val === true ? '#ef4444' : val === false ? '#3b82f6' : '#ffffff30'
          return <span className="text-sm ml-3" style={{ color }}>{'\u2764'}</span>
        })()}
        <button className="text-white/50 hover:text-white text-xl leading-none px-1" onClick={() => onClose(index)}>✕</button>
      </div>

      <div
        className="flex-1 flex items-center justify-center relative min-h-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && !imageUrl && !slideOutUrl && (
          <svg className="animate-spin h-8 w-8 text-white/40 absolute z-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {error && (
          <div className="text-red-400 text-sm">Failed to load file</div>
        )}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: sliding ? `translate3d(${slideDir === 1 ? '-100%' : '100%'}, 0, 0)` : 'translate3d(0, 0, 0)',
              transition: sliding ? 'transform 0.3s ease' : 'none',
              backfaceVisibility: 'hidden',
              willChange: 'transform',
              zIndex: 1,
            }}
          >
            {slideOutUrl ? (
              <FileRenderer url={slideOutUrl} mime={file?.mime ?? 'image/jpeg'} className="max-w-full max-h-full object-contain" />
            ) : <div />}
          </div>
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: sliding ? 'translate3d(0, 0, 0)' : slideDir ? `translate3d(${slideDir === 1 ? '100%' : '-100%'}, 0, 0)` : 'translate3d(0, 0, 0)',
              transition: sliding ? 'transform 0.3s ease' : 'none',
              backfaceVisibility: 'hidden',
              willChange: 'transform',
              zIndex: 2,
            }}
          >
            {imageUrl ? (
              <div ref={imageContainerRef} className="w-full h-full flex items-center justify-center" style={{ willChange: 'transform' }}>
                <FileRenderer url={imageUrl} mime={file?.mime ?? 'image/jpeg'} className="max-w-full max-h-full object-contain" />
              </div>
            ) : <div />}
          </div>
        </div>

        {!carouselFloatingPanel && hasPrev && (
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white/70 hover:text-white text-4xl leading-none w-10 h-14 rounded-lg flex items-center justify-center transition-colors"
            onClick={(e) => { e.stopPropagation(); goPrev() }}
          >
            ‹
          </button>
        )}
        {!carouselFloatingPanel && hasNext && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white/70 hover:text-white text-4xl leading-none w-10 h-14 rounded-lg flex items-center justify-center transition-colors"
            onClick={(e) => { e.stopPropagation(); goNext() }}
          >
            ›
          </button>
        )}
        {carouselFloatingPanel && (
          <div className={`absolute ${carouselNavSide === 'left' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 flex flex-col gap-3 z-10 transition-all duration-200 ${panelVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {(() => {
              const key = likeKeyRef.current
              const hash = hashRef.current
              if (!key || !hash) return null
              const val = likeValRef.current
              return (
                <button
                  className="w-12 h-12 bg-black/50 hover:bg-black/70 text-3xl leading-none rounded-xl flex items-center justify-center transition-colors"
                  style={{ color: val === true ? '#ef4444' : val === false ? '#3b82f6' : '#ffffff80' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setRating({ hash, rating_service_key: key, rating: val === true ? null : true })
                      .then(() => onRatingChangeRef.current?.(hash))
                  }}
                  aria-label="Toggle favorite"
                >
                  ♥
                </button>
              )
            })()}
            <button
              className={`w-12 h-12 bg-black/50 hover:bg-black/70 text-white/80 hover:text-white text-3xl leading-none rounded-xl flex items-center justify-center transition-colors ${!hasPrev ? 'opacity-20 pointer-events-none' : ''}`}
              onClick={(e) => { e.stopPropagation(); if (hasPrev) goPrev() }}
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              className={`w-12 h-12 bg-black/50 hover:bg-black/70 text-white/80 hover:text-white text-3xl leading-none rounded-xl flex items-center justify-center transition-colors ${!hasNext ? 'opacity-20 pointer-events-none' : ''}`}
              onClick={(e) => { e.stopPropagation(); if (hasNext) goNext() }}
              aria-label="Next"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {showInfo && file && (
        <div className="bg-black/80 text-white/80 text-xs px-4 py-3 space-y-0.5" onClick={(e) => e.stopPropagation()}>
          <div><span className="text-white/50">ID:</span> {file.file_id}</div>
          <div><span className="text-white/50">Hash:</span> {file.hash.slice(0, 16)}…</div>
          <div><span className="text-white/50">Size:</span> {(file.size / 1024).toFixed(1)} KB <span className="text-white/50">·</span> {file.mime} <span className="text-white/50">·</span> {file.width}&times;{file.height}</div>
          {file.duration != null && <div><span className="text-white/50">Duration:</span> {file.duration.toFixed(2)}s</div>}
          {file.file_urls && file.file_urls.length > 0 && <div><span className="text-white/50">URL:</span> {file.file_urls[0]}</div>}
        </div>
      )}

      <div className="text-center text-white/25 text-xs py-1.5" onClick={(e) => e.stopPropagation()}>
        a/d or ← → or j/k navigate · {carouselFloatingPanel ? '↑ toggle panel · ' : ''}w like · Esc close · i info
      </div>
    </div>
  )
}
