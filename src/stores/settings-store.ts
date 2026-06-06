import { create } from 'zustand'
import { searchFiles, fetchFileMetadataByIds } from '../api/search'

const SMASH_PASS_STATIC_KEY = 'hydrus-smashpass-static'
const SMASH_PASS_TAGS_KEY = 'hydrus-smashpass-tags'
const RATING_SERVICE_KEY = 'hydrus-rating-service-key'
const LIKE_SERVICE_KEY = 'hydrus-like-service-key'
const GALLERY_LAYOUT_KEY = 'hydrus-gallery-layout'
const RATINGS_CACHE_KEY = 'hydrus-ratings-cache'

type GalleryLayoutMode = 'grid' | 'mosaic'

interface SettingsState {
  darkMode: boolean
  smashPassStaticMode: boolean
  smashPassTags: string[]
  ratingServiceKey: string
  likeServiceKey: string
  galleryLayoutMode: GalleryLayoutMode
  ratingsCacheBuildProgress: number | null
  toggleDark: () => void
  toggleSmashPassStatic: () => void
  setSmashPassTags: (tags: string[]) => void
  setRatingServiceKey: (key: string) => void
  setLikeServiceKey: (key: string) => void
  setGalleryLayoutMode: (mode: GalleryLayoutMode) => void
  hydrate: () => void
  rebuildRatingsCache: (tags: string[]) => Promise<void>
  getRatingsCache: () => Map<number, Record<string, number | boolean>> | null
}

function loadRatingsCacheFromStorage(): Map<number, Record<string, number | boolean>> | null {
  const raw = localStorage.getItem(RATINGS_CACHE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return new Map(Object.entries(parsed).map(([k, v]) => [Number(k), v as Record<string, number | boolean>]))
  } catch {
    return null
  }
}

function saveRatingsCacheToStorage(cache: Map<number, Record<string, number | boolean>>) {
  const obj: Record<string, Record<string, number | boolean>> = {}
  for (const [k, v] of cache) {
    obj[k] = v
  }
  localStorage.setItem(RATINGS_CACHE_KEY, JSON.stringify(obj))
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  darkMode: false,
  smashPassStaticMode: false,
  smashPassTags: [],
  ratingServiceKey: '',
  likeServiceKey: '',
  galleryLayoutMode: 'grid',
  ratingsCacheBuildProgress: null,
  toggleDark: () => {
    const next = !get().darkMode
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('hydrus-dark-mode', String(next))
    set({ darkMode: next })
  },
  toggleSmashPassStatic: () => {
    const next = !get().smashPassStaticMode
    localStorage.setItem(SMASH_PASS_STATIC_KEY, String(next))
    set({ smashPassStaticMode: next })
  },
  setSmashPassTags: (tags) => {
    localStorage.setItem(SMASH_PASS_TAGS_KEY, JSON.stringify(tags))
    set({ smashPassTags: tags })
  },
  setRatingServiceKey: (key) => {
    localStorage.setItem(RATING_SERVICE_KEY, key)
    set({ ratingServiceKey: key })
  },
  setLikeServiceKey: (key) => {
    localStorage.setItem(LIKE_SERVICE_KEY, key)
    set({ likeServiceKey: key })
  },
  setGalleryLayoutMode: (mode) => {
    localStorage.setItem(GALLERY_LAYOUT_KEY, mode)
    set({ galleryLayoutMode: mode })
  },
  hydrate: () => {
    const dark = localStorage.getItem('hydrus-dark-mode') === 'true'
    if (dark) document.documentElement.classList.add('dark')
    const staticMode = localStorage.getItem(SMASH_PASS_STATIC_KEY) === 'true'
    const tagsRaw = localStorage.getItem(SMASH_PASS_TAGS_KEY)
    const smashPassTags: string[] = tagsRaw ? (() => { try { return JSON.parse(tagsRaw) } catch { return [] } })() : []
    const ratingSvcKey = localStorage.getItem(RATING_SERVICE_KEY) || ''
    const likeSvcKey = localStorage.getItem(LIKE_SERVICE_KEY) || ''
    const galleryLayout = (localStorage.getItem(GALLERY_LAYOUT_KEY) as GalleryLayoutMode) || 'grid'
    set({ darkMode: dark, smashPassStaticMode: staticMode, smashPassTags, ratingServiceKey: ratingSvcKey, likeServiceKey: likeSvcKey, galleryLayoutMode: galleryLayout })
  },
  rebuildRatingsCache: async (tags: string[]) => {
    set({ ratingsCacheBuildProgress: 0 })
    try {
      const result = await searchFiles({ tags, file_limit: 10000, return_hashes: false })
      const ids = result.file_ids || []
      if (ids.length === 0) {
        set({ ratingsCacheBuildProgress: null })
        return
      }
      const cache = new Map<number, Record<string, number | boolean>>()
      const chunkSize = 500
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize)
        const meta = await fetchFileMetadataByIds(chunk)
        for (const f of meta) {
          if (f.ratings) cache.set(f.file_id, f.ratings)
        }
        set({ ratingsCacheBuildProgress: Math.min(Math.round(((i + chunk.length) / ids.length) * 100), 100) })
      }
      saveRatingsCacheToStorage(cache)
      set({ ratingsCacheBuildProgress: null })
    } catch (e) {
      console.error('Failed to rebuild ratings cache:', e)
      set({ ratingsCacheBuildProgress: null })
    }
  },
  getRatingsCache: () => loadRatingsCacheFromStorage(),
}))
