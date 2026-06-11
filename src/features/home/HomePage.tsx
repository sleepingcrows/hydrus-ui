import { useState, useEffect, useRef } from 'react'
import { searchFiles, fetchFileMetadata, getThumbnailUrl } from '../../api/search'
import { useSettingsStore, type Bookmark } from '../../stores/settings-store'
import type { FileMetadata } from '../../api/types'
import { GalleryCarousel } from '../search/GalleryCarousel'

const DISPLAY_LIMIT = 50

interface SectionData {
  bookmark: Bookmark
  files: FileMetadata[]
  thumbnails: Map<number, string>
}

export function HomePage({ onSearchBookmark }: { onSearchBookmark?: (tags: string[]) => void }) {
  const bookmarks = useSettingsStore((s) => s.bookmarks)
  const removeBookmark = useSettingsStore((s) => s.removeBookmark)
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
          for (const f of meta) {
            try {
              const url = await getThumbnailUrl(f.hash)
              thumbnails.set(f.file_id, url)
            } catch { /* skip */ }
          }
          return { bookmark: b, files: meta, thumbnails }
        } catch {
          return null
        }
      })
    ).then((results) => {
      if (id !== fetchIdRef.current) return
      setSections(results.filter((r): r is SectionData => r !== null))
    })
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
                onClick={() => onSearchBookmark(s.bookmark.tags)}
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
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin" style={{ overscrollBehavior: 'contain' }}>
            {s.files.map((f, fi) => (
              <button
                key={f.file_id}
                className="flex-shrink-0 w-32 h-32 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden border-2 border-transparent hover:border-blue-500 transition-colors"
                onClick={() => setGalleryIndex({ section: si, fileIdx: fi })}
              >
                {s.thumbnails.has(f.file_id) ? (
                  <img src={s.thumbnails.get(f.file_id)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">{f.file_id}</div>
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
