import { useState, useEffect, useRef } from 'react'
import { searchFiles, fetchFileMetadata, getThumbnailUrl } from '../../api/search'
import { useSettingsStore, type Bookmark } from '../../stores/settings-store'
import type { FileMetadata } from '../../api/types'
import { GalleryCarousel } from '../search/GalleryCarousel'

interface SectionData {
  bookmark: Bookmark
  files: FileMetadata[]
  thumbnails: Map<number, string>
}

export function HomePage() {
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
          const ids = result.file_ids || []
          const hashes = result.hashes || []
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
            <button
              className="ml-auto text-xs text-gray-400 hover:text-red-400 active:text-red-500 min-h-[44px] px-2"
              onClick={() => removeBookmark(s.bookmark.id)}
            >
              Remove
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin" style={{ overscrollBehavior: 'contain' }}>
            {s.files.map((f, fi) => (
              <button
                key={f.file_id}
                className="flex-shrink-0 w-32 h-32 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800 hover:ring-2 hover:ring-blue-500 active:ring-blue-400 focus:outline-none"
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
