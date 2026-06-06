import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { searchFiles, fetchFileMetadata, fetchFileMetadataByIds, getThumbnailUrl } from '../../api/search'
import type { FileMetadata } from '../../api/types'
import { TagSearch } from './TagSearch'
import { FILE_SORT_TYPES, SERVICE_TYPE } from '../../api/types'
import { GalleryCarousel } from './GalleryCarousel'
import { TagChip } from '../../components/TagChip'
import { fetchServices } from '../../api/services'
import { useRatingServicesStore } from '../../stores/rating-services-store'
import { useSettingsStore } from '../../stores/settings-store'
const PAGE_SIZE = 200
const COL_WIDTH = 200
const COL_GAP = 8

function InboxIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
      <path d="M1 2h14l1 6v5a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V8l1-6zm1 2l-1 5h3l1 2h6l1-2h3l-1-5H2z"/>
    </svg>
  )
}

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
      <path d="M1 1h14v3H1V1zm0 4h14v9a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5zm2 2v1h10V7H3z"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
      <path d="M5 1h6l1 1h3v2H1V2h3l1-1zM2 5h12l-1.1 9a1 1 0 0 1-1 .9H4.1a1 1 0 0 1-1-.9L2 5zm3 2v6h2V7H5zm4 0v6h2V7H9z"/>
    </svg>
  )
}

interface SearchPageProps {
  presetTags?: string[]
  title?: string
  sortByRating?: boolean
  displayLimit?: number
}

export function SearchPage({ presetTags, title, sortByRating, displayLimit }: SearchPageProps = {}) {
  const [tags, setTags] = useState<string[]>(presetTags ?? [])
  const [fileIds, setFileIds] = useState<number[]>([])
  const [hashes, setHashes] = useState<string[]>([])
  const [files, setFiles] = useState<Map<number, FileMetadata>>(new Map())
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map())
  const [selectedIdx, setSelectedIdx] = useState<number>(-1)
  const [showInfoPane, setShowInfoPane] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [sortType, setSortType] = useState<number>(FILE_SORT_TYPES.IMPORT_TIME)
  const [sortAsc, setSortAsc] = useState(false)
  const [page, setPage] = useState(0)

  const galleryLayoutMode = useSettingsStore((s) => s.galleryLayoutMode)

  const tagsRef = useRef(tags)
  const sortTypeRef = useRef(sortType)
  const sortAscRef = useRef(sortAsc)
  const thumbnailsRef = useRef<Map<number, string>>(new Map())
  const searchIdRef = useRef(0)
  const fileIdsRef = useRef<number[]>([])
  const hashesRef = useRef<string[]>([])
  const hashByIdRef = useRef<Map<number, string>>(new Map())
  const requestedThumbnailsRef = useRef<Set<number>>(new Set())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const trashServiceKeysRef = useRef<Set<string>>(new Set())
  const filesRef = useRef<Map<number, FileMetadata>>(new Map())
  const loadingPageRef = useRef(false)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set())
  const [dimensionMap, setDimensionMap] = useState<Map<number, { width: number; height: number }>>(new Map())
  const ratingsCacheRef = useRef<Map<number, Record<string, number | boolean>>>(new Map())
  const numColsRef = useRef(1)

  tagsRef.current = tags
  sortTypeRef.current = sortType
  sortAscRef.current = sortAsc

  const totalPages = Math.max(1, Math.ceil(fileIds.length / PAGE_SIZE))
  const displayFileIds = useMemo(
    () => fileIds.slice(0, (page + 1) * PAGE_SIZE),
    [fileIds, page]
  )
  const currentPageFiles = useMemo(
    () => displayFileIds.map((id) => files.get(id)).filter((f): f is FileMetadata => !!f),
    [displayFileIds, files]
  )

  async function loadPage(searchId: number, targetPage: number) {
    const ids = fileIdsRef.current
    const hs = hashesRef.current
    const start = targetPage * PAGE_SIZE
    const end = start + PAGE_SIZE
    const pageIds = ids.slice(start, end)
    if (pageIds.length === 0) return

    const uncached = pageIds.filter((id) => !filesRef.current.has(id))
    if (uncached.length === 0) return

    const uncachedHashes: string[] = []
    const uncachedIds: number[] = []
    for (const id of uncached) {
      const idx = ids.indexOf(id)
      if (hs[idx]) {
        uncachedHashes.push(hs[idx])
      } else {
        uncachedIds.push(id)
      }
    }

    try {
      let meta: FileMetadata[] = []
      if (uncachedHashes.length > 0) {
        meta = await fetchFileMetadata(uncachedHashes)
      }
      if (searchId !== searchIdRef.current) return
      if (uncachedIds.length > 0) {
        const already = new Set(meta.map((f) => f.file_id))
        const needById = uncachedIds.filter((id) => !already.has(id))
        if (needById.length > 0) {
          const more = await fetchFileMetadataByIds(needById)
          meta = meta.concat(more)
        }
      }
      if (searchId !== searchIdRef.current) return
      const map = new Map(filesRef.current)
      for (const f of meta) {
        map.set(f.file_id, f)
        if (f.ratings) ratingsCacheRef.current.set(f.file_id, f.ratings)
      }
      filesRef.current = map
      setFiles(map)
    } catch (e) {
      if (searchId === searchIdRef.current) console.error('Failed to load page metadata:', e)
    }
  }

  async function doSearch() {
    const t = tagsRef.current
    const st = sortTypeRef.current
    const sa = sortAscRef.current
    if (t.length === 0) return

    const searchId = ++searchIdRef.current
    setLoading(true)
    try {
      const result = await searchFiles({ tags: t, file_sort_type: st, file_sort_asc: sa, return_hashes: true, file_limit: 10000 })
      if (searchId !== searchIdRef.current) return

      let ids = result.file_ids || []
      const hs = result.hashes || []

      thumbnailsRef.current.forEach((url) => URL.revokeObjectURL(url))
      thumbnailsRef.current.clear()
      requestedThumbnailsRef.current.clear()
      cancelAnimationFrame(flushRafIdRef.current)
      flushScheduledRef.current = false
      pendingThumbnailsRef.current.clear()
      ratingsCacheRef.current.clear()
      const storedCache = useSettingsStore.getState().getRatingsCache()
      if (storedCache) {
        for (const [fid, ratings] of storedCache) {
          ratingsCacheRef.current.set(fid, ratings)
        }
      }
      setThumbnails(new Map())
      setRevealedIds(new Set())
      setDimensionMap(new Map())

      // Set fileIds/hashes immediately so thumbnails start loading
      fileIdsRef.current = ids
      hashesRef.current = hs
      const byId = new Map<number, string>()
      for (let i = 0; i < ids.length; i++) {
        if (hs[i]) byId.set(ids[i], hs[i])
      }
      hashByIdRef.current = byId
      setFileIds(ids)
      setHashes(hs)

      if (sortByRating) {
        const allMeta = new Map<number, FileMetadata>()
        const chunkSize = 500
        const incDecKey = useRatingServicesStore.getState().services
          .find((s) => s.type === SERVICE_TYPE.INC_DEC_RATING)?.service_key

        const sortByIds = () => {
          if (!incDecKey) return
          ids.sort((a, b) => {
            const ra = allMeta.get(a)?.ratings?.[incDecKey] as number ?? -1
            const rb = allMeta.get(b)?.ratings?.[incDecKey] as number ?? -1
            return rb - ra
          })
          const sliced = displayLimit ? ids.slice(0, displayLimit) : ids
          fileIdsRef.current = sliced
          setFileIds([...sliced])
          filesRef.current = allMeta
          setFiles(new Map(allMeta))
        }

        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunkHashes = hs.slice(i, i + chunkSize).filter(Boolean)
          const chunkIds = ids.slice(i, i + chunkSize).filter((_id, j) => !hs[i + j])
          if (chunkHashes.length > 0) {
            const meta = await fetchFileMetadata(chunkHashes)
            for (const f of meta) {
              allMeta.set(f.file_id, f)
              if (f.ratings) ratingsCacheRef.current.set(f.file_id, f.ratings)
            }
          }
          if (chunkIds.length > 0) {
            const meta = await fetchFileMetadataByIds(chunkIds)
            for (const f of meta) {
              allMeta.set(f.file_id, f)
              if (f.ratings) ratingsCacheRef.current.set(f.file_id, f.ratings)
            }
          }
          if (searchId !== searchIdRef.current) return
          sortByIds()
        }
      } else {
        filesRef.current = new Map()
        setFiles(new Map())
        if (ids.length > 0) {
          await loadPage(searchId, 0)
        }
      }

      setPage(0)
      setSelectedIdx(-1)
      setGalleryIndex(null)
      loadingPageRef.current = false
    } catch (e) {
      if (searchId === searchIdRef.current) console.error('Search failed:', e)
    } finally {
      if (searchId === searchIdRef.current) setLoading(false)
    }
  }

  function goPage(newPage: number) {
    if (newPage < 0 || newPage >= totalPagesRef.current) return
    const sid = searchIdRef.current
    loadingPageRef.current = true
    setPage(newPage)
    setSelectedIdx(-1)
    loadPage(sid, newPage).finally(() => {
      if (sid === searchIdRef.current) loadingPageRef.current = false
    })
  }

  useEffect(() => {
    return () => {
      cancelAnimationFrame(flushRafIdRef.current)
      thumbnailsRef.current.forEach((url) => URL.revokeObjectURL(url))
      thumbnailsRef.current.clear()
    }
  }, [])

  useEffect(() => {
    fetchServices().then((services) => {
      trashServiceKeysRef.current = new Set(
        services.filter((s) => s.type === SERVICE_TYPE.TRASH).map((s) => s.service_key)
      )
    })
  }, [])

  useEffect(() => {
    if (presetTags && presetTags.length > 0) doSearch()
  }, [])

  function handleTagsChange(newTags: string[]) {
    setTags(newTags)
    if (newTags.length === 0) {
      setFileIds([])
      setHashes([])
      setFiles(new Map())
      setThumbnails(new Map())
    }
  }

  const pendingThumbnailsRef = useRef(new Map<number, string>())
  const flushScheduledRef = useRef(false)
  const flushRafIdRef = useRef(0)

  function scheduleFlush() {
    if (flushScheduledRef.current) return
    flushScheduledRef.current = true
    flushRafIdRef.current = requestAnimationFrame(() => {
      flushScheduledRef.current = false
      const pending = pendingThumbnailsRef.current
      if (pending.size === 0) return
      for (const [id, url] of pending) {
        thumbnailsRef.current.set(id, url)
      }
      pending.clear()
      setThumbnails(new Map(thumbnailsRef.current))
    })
  }

  useEffect(() => {
    if (galleryLayoutMode !== 'mosaic') {
      return
    }
    const grid = gridRef.current
    if (!grid) return

    grid.style.position = 'relative'
    grid.style.width = '100%'

    const updateColumns = () => {
      if (!gridRef.current) return
      const gridWidth = gridRef.current.offsetWidth
      const numCols = Math.max(1, Math.ceil(gridWidth / (COL_WIDTH + COL_GAP)))
      const totalGapWidth = (numCols - 1) * COL_GAP
      const itemWidth = (gridWidth - totalGapWidth) / numCols
      numColsRef.current = numCols
      gridRef.current!.style.columnCount = String(numCols)
      gridRef.current!.style.columnGap = `${COL_GAP}px`
      for (const child of Array.from(gridRef.current!.children)) {
        if (child.classList.contains('mosaic-item')) {
          (child as HTMLElement).style.width = `${itemWidth}px`
        }
      }
    }

    requestAnimationFrame(() => {
      updateColumns()
      requestAnimationFrame(() => {
        updateColumns()
      })
    })
  }, [galleryLayoutMode])

  useEffect(() => {
    if (galleryLayoutMode !== 'mosaic') return
    const handleResize = () => {
      if (!gridRef.current) return
      const gridWidth = gridRef.current.offsetWidth
      const numCols = Math.max(1, Math.ceil(gridWidth / (COL_WIDTH + COL_GAP)))
      const totalGapWidth = (numCols - 1) * COL_GAP
      const itemWidth = (gridWidth - totalGapWidth) / numCols
      numColsRef.current = numCols
      gridRef.current.style.columnCount = String(numCols)
      for (const child of Array.from(gridRef.current.children)) {
        if (child.classList.contains('mosaic-item')) {
          (child as HTMLElement).style.width = `${itemWidth}px`
        }
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [galleryLayoutMode])

  useEffect(() => {
    if (!scrollRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const id = Number(entry.target.getAttribute('data-id'))
          if (!id || requestedThumbnailsRef.current.has(id)) continue
          requestedThumbnailsRef.current.add(id)
          const hash = hashByIdRef.current.get(id)
          if (!hash) continue
          const sid = searchIdRef.current
          getThumbnailUrl(hash)
            .then((url) => {
              if (searchIdRef.current !== sid) { URL.revokeObjectURL(url); return }
              pendingThumbnailsRef.current.set(id, url)
              scheduleFlush()
            })
            .catch((e) => console.warn('Thumbnail fetch failed for', id, e))
        }
      },
      { root: scrollRef.current, rootMargin: '5000px 0px 5000px 0px' }
    )
    observerRef.current = observer
    if (gridRef.current) {
      for (const child of gridRef.current.children) {
        if (child.hasAttribute('data-id')) observer.observe(child)
      }
    }
    return () => observer.disconnect()
  }, [])

  const thumbnailRef = useCallback((el: HTMLElement | null) => {
    if (el) observerRef.current?.observe(el)
  }, [])

  const pageRef = useRef(page)
  const totalPagesRef = useRef(totalPages)
  pageRef.current = page
  totalPagesRef.current = totalPages

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelObserverRef = useRef<IntersectionObserver | null>(null)

  const sentinelRef = useCallback((el: HTMLDivElement | null) => {
    sentinelObserverRef.current?.disconnect()
    sentinelObserverRef.current = null
    if (!el) return
    const root = scrollRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingPageRef.current && pageRef.current < totalPagesRef.current - 1) {
          goPage(pageRef.current + 1)
        }
      },
      { root, rootMargin: '400px' }
    )
    observer.observe(el)
    sentinelObserverRef.current = observer
  }, [])

  function loadMore() {
    if (!loadingPageRef.current && pageRef.current < totalPagesRef.current - 1) {
      goPage(pageRef.current + 1)
    }
  }

  async function handleRatingChange(hash: string) {
    const meta = await fetchFileMetadata([hash])
    if (meta.length === 0) return
    const map = new Map(filesRef.current)
    map.set(meta[0].file_id, meta[0])
    if (meta[0].ratings) ratingsCacheRef.current.set(meta[0].file_id, meta[0].ratings)
    filesRef.current = map
    setFiles(map)
  }

  const selectedFile = selectedIdx >= 0 && selectedIdx < displayFileIds.length
    ? files.get(displayFileIds[selectedIdx]) ?? null
    : null

  function handleKeyDown(e: globalThis.KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
    if (galleryIndex !== null) return
    if (e.key === 'Enter' && selectedIdx >= 0) {
      e.preventDefault()
      setGalleryIndex(selectedIdx)
      return
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((prev) => Math.min(Math.max(prev + 1, -1), displayFileIds.length - 1))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((prev) => Math.max(prev - 1, -1))
    } else if (e.key === 'i' && selectedIdx >= 0) {
      e.preventDefault()
      setShowInfoPane((prev) => !prev)
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 p-2 items-center flex-wrap">
        {presetTags ? (
          <>
            <span className="text-sm font-bold">{title ?? 'Gallery'}</span>
            <span className="text-xs text-gray-500">{fileIds.length} files</span>
          </>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <TagSearch tags={tags} onTagsChange={handleTagsChange} onSubmit={doSearch} />
            </div>
            <select
              className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 dark:border-gray-600"
              value={sortType}
              onChange={(e) => setSortType(Number(e.target.value))}
            >
              <option value={FILE_SORT_TYPES.IMPORT_TIME}>Import Time</option>
              <option value={FILE_SORT_TYPES.FILE_SIZE}>File Size</option>
              <option value={FILE_SORT_TYPES.DURATION}>Duration</option>
              <option value={FILE_SORT_TYPES.NUMBER_OF_PIXELS}>Pixels</option>
              <option value={FILE_SORT_TYPES.RANDOM}>Random</option>
            </select>
            <button
              className="text-sm px-2 py-1 border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 dark:border-gray-600"
              onClick={() => setSortAsc(!sortAsc)}
              title={sortAsc ? 'Newest first' : 'Oldest first'}
            >
              {sortAsc ? '\u2191' : '\u2193'}
            </button>
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
              onClick={doSearch}
              disabled={loading || tags.length === 0}
            >
              {loading ? '...' : 'Search'}
            </button>
            <span className="text-xs text-gray-500">{fileIds.length} files</span>
          </>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div
          className={`flex-1 min-w-0 overflow-y-auto p-2 ${galleryLayoutMode === 'mosaic' ? '' : ''}`}
          ref={scrollRef}
          tabIndex={-1}
          style={galleryLayoutMode === 'mosaic' ? { width: '100%', boxSizing: 'border-box' } : undefined}
        >
          <div
            ref={gridRef}
            className={galleryLayoutMode === 'mosaic' ? 'mosaic-grid' : 'grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 auto-rows-max'}
            style={galleryLayoutMode === 'mosaic' ? { isolation: 'isolate' } : undefined}
          >
          {displayFileIds.map((id, i) => (
            <div
              key={id}
              ref={thumbnailRef}
              data-id={id}
              className={`bg-gray-100 dark:bg-gray-800 rounded overflow-hidden cursor-pointer border-2 mb-2 ${galleryLayoutMode === 'grid' ? 'aspect-square' : 'mosaic-item'} ${
                i === selectedIdx ? 'border-blue-500' : 'border-transparent'
              } relative`}
              style={galleryLayoutMode === 'mosaic' && thumbnails.has(id) ? (() => {
                const cached = dimensionMap.get(id)
                if (cached) {
                  const ratio = cached.height / cached.width
                  return { aspectRatio: `${1} / ${ratio}` }
                }
                return {}
              })() : undefined}
              onClick={() => { setSelectedIdx(i); setShowInfoPane(false) }}
              onDoubleClick={() => setGalleryIndex(i)}
            >
              {(() => {
                const f = files.get(id)
                if (!f) return null
                const trashKeys = trashServiceKeysRef.current
                if (f.file_services && Object.keys(f.file_services).some(k => trashKeys.has(k))) {
                  return <div className="absolute top-1 left-1 w-5 h-5 bg-gray-100/80 dark:bg-gray-800/80 rounded flex items-center justify-center text-red-500"><TrashIcon /></div>
                }
                if (f.is_inbox) return <div className="absolute top-1 left-1 w-5 h-5 bg-gray-100/80 dark:bg-gray-800/80 rounded flex items-center justify-center text-blue-400"><InboxIcon /></div>
                if (f.is_inbox === false) return <div className="absolute top-1 left-1 w-5 h-5 bg-gray-100/80 dark:bg-gray-800/80 rounded flex items-center justify-center text-green-500"><ArchiveIcon /></div>
                return null
              })()}
              {(() => {
                const configuredKey = useSettingsStore.getState().ratingServiceKey
                const services = useRatingServicesStore.getState().services
                const incKey = configuredKey || services.find((s) => s.type === SERVICE_TYPE.INC_DEC_RATING)?.service_key
                if (!incKey) return null
                const cachedRatings = ratingsCacheRef.current.get(id)
                const elo = cachedRatings?.[incKey]
                if (elo == null || typeof elo !== 'number') return null
                const rank = sortByRating ? displayFileIds.indexOf(id) + 1 : 0
const rankColor = rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-600' : 'text-white/70'
                const rankBg = rank <= 3 ? 'bg-black/60' : 'bg-black/50'
                const rankSuffix = rank % 10 === 1 && rank % 100 !== 11 ? 'st' : rank % 10 === 2 && rank % 100 !== 12 ? 'nd' : rank % 10 === 3 && rank % 100 !== 13 ? 'rd' : 'th'
                return (
                  <div className="absolute bottom-1 left-1 flex flex-col items-start gap-0.5">
                    {sortByRating && rank > 0 && (
                      <span className={`${rankBg} ${rankColor} text-[10px] px-1 rounded font-bold`}>
                        {rank}{rankSuffix}
                      </span>
                    )}
                    <span className="bg-black/60 text-white text-[10px] leading-tight px-1 rounded">{elo} ELO</span>
                  </div>
                )
              })()}
              {(() => {
                const configuredKey = useSettingsStore.getState().likeServiceKey
                const services = useRatingServicesStore.getState().services
                const likeKey = configuredKey || services.find((s) => s.type === SERVICE_TYPE.LIKE_DISLIKE_RATING)?.service_key
                if (!likeKey) return null
                const cachedRatings = ratingsCacheRef.current.get(id)
                const val = cachedRatings?.[likeKey]
                if (val == null || typeof val !== 'boolean') return null
                return (
                  <div className="absolute top-1 right-1 text-sm leading-none" style={{ color: val ? '#ef4444' : '#3b82f6' }}>
                    {'\u2764'}
                  </div>
                )
              })()}
              {i === selectedIdx && (
                <button
                  className="absolute bottom-1 right-1 w-5 h-5 bg-gray-100/80 dark:bg-gray-800/80 rounded flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 z-10"
                  onClick={(e) => { e.stopPropagation(); setShowInfoPane(true) }}
                  title="File info (i)"
                >
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5"/><rect x="7.25" y="6.5" width="1.5" height="1.5" rx="0.5"/><rect x="7.25" y="9" width="1.5" height="3.5" rx="0.5"/></svg>
                </button>
              )}
              {thumbnails.has(id) ? (
                <img
                  src={thumbnails.get(id)}
                  alt=""
                  className={`w-full h-full object-cover transition-opacity duration-300 ${revealedIds.has(id) ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement
                    setRevealedIds((prev) => {
                      const next = new Set(prev)
                      next.add(id)
                      return next
                    })
                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                      setDimensionMap((prev) => {
                        const next = new Map(prev)
                        next.set(id, { width: img.naturalWidth, height: img.naturalHeight })
                        return next
                      })
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 animate-pulse bg-gray-200 dark:bg-gray-700 rounded">{id}</div>
              )}
            </div>
          ))}
          {fileIds.length === 0 && !loading && (
            <div className={galleryLayoutMode === 'mosaic' ? 'text-center text-gray-400 py-8 w-full' : 'col-span-full text-center text-gray-400 py-8'}>{presetTags ? 'No files found' : 'Add tags and click Search'}</div>
          )}
          {loading && <div className={galleryLayoutMode === 'mosaic' ? 'text-center text-gray-400 py-8 w-full' : 'col-span-full text-center text-gray-400 py-8'}>Searching...</div>}

          {fileIds.length > 0 && (
            <>
            <div className={`flex items-center justify-center gap-2 py-4 text-sm text-gray-500 ${galleryLayoutMode === 'mosaic' ? 'w-full' : 'col-span-full'}`}>
              <span className="px-3">
                Loaded {page + 1} / {totalPages} pages · {displayFileIds.length} / {fileIds.length} files
              </span>
              <button
                className="px-2 py-1 border rounded disabled:opacity-30 bg-white dark:bg-gray-800 dark:border-gray-600"
                disabled={page >= totalPages - 1}
                onClick={() => goPage(page + 1)}
              >
                Load next page ›
              </button>
            </div>
            <div ref={sentinelRef} className={galleryLayoutMode === 'mosaic' ? 'w-full h-2' : 'col-span-full h-2'} />
            </>
          )}
        </div>
        </div>

        {selectedFile && showInfoPane && (
          <div className="fixed right-0 top-0 bottom-0 w-80 border-l dark:border-gray-700 overflow-y-auto p-3 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 z-50">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-sm">File Info</h3>
              <button onClick={() => { setShowInfoPane(false); setSelectedIdx(-1) }} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-lg leading-none">&times;</button>
            </div>
            <div className="space-y-1 text-xs">
              <div><span className="text-gray-500">ID:</span> {selectedFile.file_id}</div>
              <div><span className="text-gray-500">Hash:</span> <code className="break-all">{selectedFile.hash.slice(0, 16)}...</code></div>
              <div><span className="text-gray-500">Size:</span> {(selectedFile.size / 1024).toFixed(1)} KB</div>
              <div><span className="text-gray-500">Type:</span> {selectedFile.mime}</div>
              <div><span className="text-gray-500">Dimensions:</span> {selectedFile.width}&times;{selectedFile.height}</div>
              {selectedFile.duration != null && <div><span className="text-gray-500">Duration:</span> {selectedFile.duration.toFixed(2)}s</div>}
              {selectedFile.is_inbox !== undefined && (
                <div><span className="text-gray-500">Status:</span> {selectedFile.is_inbox ? 'Inbox' : 'Archive'}</div>
              )}
            </div>
            {(() => {
              const rawTags = selectedFile.tags
                ? [...new Set(Object.values(selectedFile.tags).flatMap(
                    (entry) => entry.display_tags?.['0'] ?? []
                  ))]
                : []
              const tagList = rawTags.sort((a, b) => {
                const colonA = a.indexOf(':')
                const colonB = b.indexOf(':')
                const nsA = colonA === -1 ? '' : a.slice(0, colonA)
                const nsB = colonB === -1 ? '' : b.slice(0, colonB)
                if (nsA !== nsB) {
                  if (nsA === '') return 1
                  if (nsB === '') return -1
                  return nsA.localeCompare(nsB)
                }
                const tagA = colonA === -1 ? a : a.slice(colonA + 1)
                const tagB = colonB === -1 ? b : b.slice(colonB + 1)
                return tagA.localeCompare(tagB)
              })
              if (tagList.length === 0) return null
              return (
                <>
                  <h4 className="font-bold text-xs mt-3 mb-1">Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {tagList.map((tag) => (
                      <TagChip key={tag} tag={tag} size="sm" />
                    ))}
                  </div>
                </>
              )
            })()}
          </div>
        )}
      </div>

      {galleryIndex !== null && (
        <GalleryCarousel
          files={currentPageFiles}
          initialIndex={galleryIndex}
          onClose={() => setGalleryIndex(null)}
          hasMore={page < totalPages - 1}
          onRequestMore={loadMore}
          onRatingChange={handleRatingChange}
          sortByRating={sortByRating}
        />
      )}
    </div>
  )
}
