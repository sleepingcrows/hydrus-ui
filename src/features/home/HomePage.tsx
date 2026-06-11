import { useState, useEffect, useRef } from 'react'
import { searchFiles, fetchFileMetadata, getThumbnailUrl } from '../../api/search'
import { useSettingsStore, type Bookmark } from '../../stores/settings-store'
import { useRatingServicesStore } from '../../stores/rating-services-store'
import { SERVICE_TYPE } from '../../api/types'
import type { FileMetadata } from '../../api/types'
import { GalleryCarousel } from '../search/GalleryCarousel'

const DISPLAY_LIMIT = 50

interface SectionData {
  bookmark: Bookmark
  files: FileMetadata[]
  thumbnails: Map<number, string>
}

export function HomePage({ onSearchBookmark }: { onSearchBookmark?: (tags: string[], sortType: number, sortAsc: boolean) => void }) {
  const bookmarks = useSettingsStore((s) => s.bookmarks)
  const removeBookmark = useSettingsStore((s) => s.removeBookmark)
  const configuredLikeKey = useSettingsStore((s) => s.likeServiceKey)
  const configuredRatingKey = useSettingsStore((s) => s.ratingServiceKey)
  const allServices = useRatingServicesStore((s) => s.services)
  const likeKey = configuredLikeKey || allServices.find((svc) => svc.type === SERVICE_TYPE.LIKE_DISLIKE_RATING)?.service_key
  const ratingKey = configuredRatingKey || allServices.find((svc) => svc.type === SERVICE_TYPE.INC_DEC_RATING)?.service_key
  const [sections, setSections] = useState<SectionData[]>([])
  const [galleryIndex, setGalleryIndex] = useState<{ section: number; fileIdx: number } | null>(null)
  const fetchIdRef = useRef(0)

  useEffect(() => {
    const id = ++fetchIdRef.current
    setSections([])
    if (bookmarks.length === 0) return
    Promise.all(
      bookmarks.map(async (b) => {
        try {
          const result = await searchFiles({
            tags: b.tags,
            file_sort_type: b.sortType,
            file_sort_asc: b.sortAsc,
            return_hashes: true,
            file_limit: b.limit,
          })
          if (id !== fetchIdRef.current) return null
          const ids = (result.file_ids || []).slice(0, DISPLAY_LIMIT)
          const hashes = (result.hashes || []).slice(0, DISPLAY_LIMIT)
          if (ids.length === 0) return null
          const meta = await fetchFileMetadata(hashes.filter(Boolean))
          if (id !== fetchIdRef.current) return null
          const thumbnails = new Map<number, string>()
          setSections((prev) => [...prev, { bookmark: b, files: meta, thumbnails }])
          for (const f of meta) {
            try {
              const url = await getThumbnailUrl(f.hash)
              if (id !== fetchIdRef.current) return null
              thumbnails.set(f.file_id, url)
              setSections((prev) => prev.map((s) => s.bookmark.id === b.id ? { ...s, thumbnails: new Map(s.thumbnails).set(f.file_id, url) } : s))
            } catch { /* skip */ }
          }
          return null
        } catch {
          return null
        }
      })
    )
    return () => { fetchIdRef.current = id }
  }, [bookmarks])

  useEffect(() => {
    return () => {
      for (const s of sections) {
        for (const url of s.thumbnails.values()) URL.revokeObjectURL(url)
      }
    }
  }, [sections])

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6 text-gray-900 dark:text-gray-100">
      {bookmarks.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
          <p className="text-lg">No bookmarks yet</p>
          <p className="text-sm">Search for something and bookmark it from the Search tab.</p>
        </div>
      )}
      {sections.map((s, si) => (
        <div key={s.bookmark.id}>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-bold truncate">{s.bookmark.name}</h2>
            <span className="text-xs text-gray-500">{s.files.length} files</span>
            {onSearchBookmark && (
              <button
                className="min-h-[44px] min-w-[44px] p-2 rounded text-gray-400 hover:text-blue-400 active:text-blue-300 transition-colors"
                onClick={() => onSearchBookmark(s.bookmark.tags, s.bookmark.sortType, s.bookmark.sortAsc)}
                aria-label="Search this bookmark"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </button>
            )}
            <button
              className="ml-auto text-gray-400 hover:text-red-400 active:text-red-500 min-h-[44px] w-11 flex items-center justify-center transition-colors"
              onClick={() => { if (confirm('Remove bookmark "' + s.bookmark.name + '"?')) removeBookmark(s.bookmark.id) }}
            >
              ✕
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin" style={{ overscrollBehavior: 'contain' }} onWheel={(e) => { e.currentTarget.scrollLeft += e.deltaY; e.preventDefault() }}>
            {s.files.map((f, fi) => (
              <button
                key={f.file_id}
                className="flex-shrink-0 w-32 h-32 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden border-2 border-transparent hover:border-blue-500 transition-colors relative"
                onClick={() => setGalleryIndex({ section: si, fileIdx: fi })}
              >
                {(() => {
                  if (f.is_trashed) return <div className="absolute top-1 left-1 w-5 h-5 bg-gray-100/80 dark:bg-gray-800/80 rounded flex items-center justify-center text-red-500"><svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><path d="M5 1h6l1 1h3v2H1V2h3l1-1zM2 5h12l-1.1 9a1 1 0 0 1-1 .9H4.1a1 1 0 0 1-1-.9L2 5zm3 2v6h2V7H5zm4 0v6h2V7H9z"/></svg></div>
                  if (f.is_inbox) return <div className="absolute top-1 left-1 w-5 h-5 bg-gray-100/80 dark:bg-gray-800/80 rounded flex items-center justify-center text-blue-400"><svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><path d="M1 2h14l1 6v5a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V8l1-6zm1 2l-1 5h3l1 2h6l1-2h3l-1-5H2z"/></svg></div>
                  if (f.is_inbox === false) return <div className="absolute top-1 left-1 w-5 h-5 bg-gray-100/80 dark:bg-gray-800/80 rounded flex items-center justify-center text-green-500"><svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><path d="M1 1h14v3H1V1zm0 4h14v9a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5zm2 2v1h10V7H3z"/></svg></div>
                  return null
                })()}
                {likeKey && f.ratings?.[likeKey] != null && typeof f.ratings[likeKey] === 'boolean' && (
                  <div className="absolute top-1 right-1 text-sm leading-none" style={{ color: f.ratings[likeKey] ? '#ef4444' : '#3b82f6' }}>
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                  </div>
                )}
                {ratingKey && f.ratings?.[ratingKey] != null && (
                  <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] leading-tight px-1 rounded font-mono">
                    {Number(f.ratings[ratingKey])} ELO
                  </div>
                )}
                {s.thumbnails.has(f.file_id) ? (
                  <img src={s.thumbnails.get(f.file_id)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      {galleryIndex && sections[galleryIndex.section] && (
        <GalleryCarousel
          files={sections[galleryIndex.section].files}
          initialIndex={galleryIndex.fileIdx}
          onClose={() => setGalleryIndex(null)}
        />
      )}
    </div>
  )
}
