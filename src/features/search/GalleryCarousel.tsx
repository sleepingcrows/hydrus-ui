import { useState, useEffect, useRef } from 'react'
import { getFileUrl } from '../../api/search'
import type { FileMetadata } from '../../api/types'
import { SERVICE_TYPE } from '../../api/types'
import { useRatingServicesStore } from '../../stores/rating-services-store'
import { useSettingsStore } from '../../stores/settings-store'
import { setRating } from '../../api/ratings'
import { FileRenderer } from '../../components/FileRenderer'

interface Props {
  files: FileMetadata[]
  initialIndex: number
  onClose: () => void
  hasMore?: boolean
  onRequestMore?: () => void
  onRatingChange?: (hash: string) => void | Promise<void>
}

export function GalleryCarousel({ files, initialIndex, onClose, hasMore, onRequestMore, onRatingChange }: Props) {
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

  useEffect(() => {
    if (!file) return
    let cancelled = false

    setLoading(true)
    setError(false)
    setImageUrl(null)

    getFileUrl(file.hash)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current)
        prevUrlRef.current = url
        setImageUrl(url)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [file?.hash])

  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current)
    }
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      switch (e.key) {
        case 'Escape':
          onClose()
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

  function goNext() {
    if (index < files.length - 1) {
      setIndex((prev) => prev + 1)
    } else if (hasMoreRef.current && !loadingMoreRef.current) {
      loadingMoreRef.current = true
      onRequestMoreRef.current?.()
    }
  }
  function goPrev() { setIndex((prev) => Math.max(prev - 1, 0)) }
  goNextRef.current = goNext
  goPrevRef.current = goPrev

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-2" onClick={(e) => e.stopPropagation()}>
        <span className="text-white/70 text-sm">{index + 1} / {files.length}</span>
        {(() => {
          const configuredKey = useSettingsStore.getState().ratingServiceKey
          const services = useRatingServicesStore.getState().services
          const key = configuredKey || services.find((s) => s.type === SERVICE_TYPE.INC_DEC_RATING)?.service_key
          if (!key) return null
          const elo = file?.ratings?.[key]
          if (elo == null || typeof elo !== 'number') return null
          return <span className="text-white/50 text-sm ml-3">{elo} ELO</span>
        })()}
        {(() => {
          const key = likeKeyRef.current
          if (!key) return null
          const raw = file?.ratings?.[key]
          const val = raw != null && typeof raw === 'boolean' ? raw : null
          const color = val === true ? '#ef4444' : val === false ? '#3b82f6' : '#ffffff30'
          return <span className="text-sm ml-3" style={{ color }}>{'\u2764'}</span>
        })()}
        <button className="text-white/50 hover:text-white text-xl leading-none px-1" onClick={onClose}>✕</button>
      </div>

      <div
        className="flex-1 flex items-center justify-center relative min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && !error && (
          <svg className="animate-spin h-8 w-8 text-white/40" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {error && (
          <div className="text-red-400 text-sm">Failed to load file</div>
        )}
        {imageUrl && !loading && (
          <FileRenderer url={imageUrl} mime={file?.mime ?? 'image/jpeg'} className="max-w-full max-h-full object-contain" />
        )}

        {hasPrev && (
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white/70 hover:text-white text-4xl leading-none w-10 h-14 rounded-lg flex items-center justify-center transition-colors"
            onClick={(e) => { e.stopPropagation(); goPrev() }}
          >
            ‹
          </button>
        )}
        {hasNext && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white/70 hover:text-white text-4xl leading-none w-10 h-14 rounded-lg flex items-center justify-center transition-colors"
            onClick={(e) => { e.stopPropagation(); goNext() }}
          >
            ›
          </button>
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
        a/d or ← → or j/k navigate · w like · Esc close · i info
      </div>
    </div>
  )
}
