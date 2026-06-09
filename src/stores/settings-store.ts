import { create } from 'zustand'
import { searchFiles, fetchFileMetadataByIds } from '../api/search'

const SMASH_PASS_STATIC_KEY = 'hydrus-smashpass-static'
const SMASH_PASS_TAGS_KEY = 'hydrus-smashpass-tags'
const SMASH_PASS_TAGS_B_KEY = 'hydrus-smashpass-tags-b'
const SMASH_PASS_DUAL_KEY = 'hydrus-smashpass-dual'
const RATING_SERVICE_KEY = 'hydrus-rating-service-key'
const LIKE_SERVICE_KEY = 'hydrus-like-service-key'
const GALLERY_LAYOUT_KEY = 'hydrus-gallery-layout'
const RATINGS_CACHE_KEY = 'hydrus-ratings-cache'
const TERMINATED_MODE_KEY = 'hydrus-terminated-mode'
const SEARCH_HISTORY_KEY = 'hydrus-search-history'
const RATING_BASE_INC_KEY = 'hydrus-rating-base-inc'
const RATING_LOSER_DEC_KEY = 'hydrus-rating-loser-dec'
const RATING_STREAK_THRESHOLD_KEY = 'hydrus-rating-streak-threshold'
const RATING_STREAK_BONUS_KEY = 'hydrus-rating-streak-bonus'
const RATING_UNDERDOG_THRESHOLD_KEY = 'hydrus-rating-underdog-threshold'
const RATING_UNDERDOG_MIN_GAP_KEY = 'hydrus-rating-underdog-min-gap'
const RATING_UNDERDOG_BOOST_PCT_KEY = 'hydrus-rating-underdog-boost-pct'
const CAROUSEL_FLOATING_PANEL_KEY = 'hydrus-carousel-floating-panel'
const CAROUSEL_NAV_SIDE_KEY = 'hydrus-carousel-nav-side'

type GalleryLayoutMode = 'grid' | 'mosaic'

interface SettingsState {
  darkMode: boolean
  smashPassStaticMode: boolean
  terminatedMode: boolean
  smashPassTags: string[]
  smashPassTagsB: string[]
  smashPassDualMode: boolean
  searchHistory: string[][]
  ratingServiceKey: string
  likeServiceKey: string
  galleryLayoutMode: GalleryLayoutMode
  ratingsCacheBuildProgress: number | null
  ratingBaseInc: number
  ratingLoserDec: number
  ratingStreakThreshold: number
  ratingStreakBonus: number
  underdogThreshold: number
  underdogMinGap: number
  underdogBoostPct: number
  carouselFloatingPanel: boolean
  carouselNavSide: 'left' | 'right'
  toggleDark: () => void
  toggleSmashPassStatic: () => void
  toggleTerminatedMode: () => void
  setSmashPassTags: (tags: string[]) => void
  setSmashPassTagsB: (tags: string[]) => void
  toggleSmashPassDualMode: () => void
  addToSearchHistory: (tags: string[]) => void
  setRatingServiceKey: (key: string) => void
  setLikeServiceKey: (key: string) => void
  setGalleryLayoutMode: (mode: GalleryLayoutMode) => void
  setRatingBaseInc: (n: number) => void
  setRatingLoserDec: (n: number) => void
  setRatingStreakThreshold: (n: number) => void
  setRatingStreakBonus: (n: number) => void
  setUnderdogThreshold: (n: number) => void
  setUnderdogMinGap: (n: number) => void
  setUnderdogBoostPct: (n: number) => void
  toggleCarouselFloatingPanel: () => void
  setCarouselNavSide: (side: 'left' | 'right') => void
  hydrate: () => void
  rebuildRatingsCache: (tags: string[]) => Promise<void>
  getRatingsCache: () => Map<number, Record<string, number | boolean>> | null
  addToRatingsCache: (entries: Iterable<[number, Record<string, number | boolean>]>) => void
}

function loadStr(key: string, fallback: string): string { try { return localStorage.getItem(key) ?? fallback } catch { return fallback } }
function loadNum(key: string, fallback: number): number { try { return Number(localStorage.getItem(key)) || fallback } catch { return fallback } }
function loadBool(key: string): boolean { try { return localStorage.getItem(key) === 'true' } catch { return false } }
function loadJson<T>(key: string, fallback: T): T { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback } catch { return fallback } }

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
  darkMode: loadBool('hydrus-dark-mode'),
  smashPassStaticMode: loadBool('hydrus-smashpass-static'),
  terminatedMode: loadBool('hydrus-terminated-mode'),
  smashPassTags: loadJson<string[]>('hydrus-smashpass-tags', []),
  smashPassTagsB: loadJson<string[]>('hydrus-smashpass-tags-b', []),
  smashPassDualMode: loadBool('hydrus-smashpass-dual'),
  searchHistory: loadJson<string[][]>('hydrus-search-history', []),
  ratingBaseInc: loadNum('hydrus-rating-base-inc', 5),
  ratingLoserDec: loadNum('hydrus-rating-loser-dec', 2),
  ratingStreakThreshold: loadNum('hydrus-rating-streak-threshold', 3),
  ratingStreakBonus: loadNum('hydrus-rating-streak-bonus', 1),
  underdogThreshold: loadNum('hydrus-rating-underdog-threshold', 5),
  underdogMinGap: loadNum('hydrus-rating-underdog-min-gap', 20),
  underdogBoostPct: loadNum('hydrus-rating-underdog-boost-pct', 75),
  ratingServiceKey: loadStr('hydrus-rating-service-key', ''),
  likeServiceKey: loadStr('hydrus-like-service-key', ''),
  galleryLayoutMode: (loadStr('hydrus-gallery-layout', 'grid') as GalleryLayoutMode),
  carouselFloatingPanel: localStorage.getItem(CAROUSEL_FLOATING_PANEL_KEY) !== null
    ? loadBool('hydrus-carousel-floating-panel')
    : (typeof window !== 'undefined' && window.innerWidth < 768),
  carouselNavSide: (loadStr('hydrus-carousel-nav-side', 'right') as 'left' | 'right'),
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
  toggleTerminatedMode: () => {
    const next = !get().terminatedMode
    localStorage.setItem(TERMINATED_MODE_KEY, String(next))
    set({ terminatedMode: next })
  },
  setSmashPassTags: (tags) => {
    localStorage.setItem(SMASH_PASS_TAGS_KEY, JSON.stringify(tags))
    set({ smashPassTags: tags })
  },
  setSmashPassTagsB: (tags) => {
    localStorage.setItem(SMASH_PASS_TAGS_B_KEY, JSON.stringify(tags))
    set({ smashPassTagsB: tags })
  },
  toggleSmashPassDualMode: () => {
    const next = !get().smashPassDualMode
    localStorage.setItem(SMASH_PASS_DUAL_KEY, String(next))
    set({ smashPassDualMode: next })
  },
  addToSearchHistory: (tags) => {
    if (tags.length === 0) return
    const existing = get().searchHistory
    const key = JSON.stringify(tags)
    const filtered = existing.filter((t) => JSON.stringify(t) !== key)
    const updated = [tags, ...filtered].slice(0, 20)
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated))
    set({ searchHistory: updated })
  },
  setRatingBaseInc: (n) => { localStorage.setItem(RATING_BASE_INC_KEY, String(n)); set({ ratingBaseInc: n }) },
  setRatingLoserDec: (n) => { localStorage.setItem(RATING_LOSER_DEC_KEY, String(n)); set({ ratingLoserDec: n }) },
  setRatingStreakThreshold: (n) => { localStorage.setItem(RATING_STREAK_THRESHOLD_KEY, String(n)); set({ ratingStreakThreshold: n }) },
  setRatingStreakBonus: (n) => { localStorage.setItem(RATING_STREAK_BONUS_KEY, String(n)); set({ ratingStreakBonus: n }) },
  setUnderdogThreshold: (n) => { localStorage.setItem(RATING_UNDERDOG_THRESHOLD_KEY, String(n)); set({ underdogThreshold: n }) },
  setUnderdogMinGap: (n) => { localStorage.setItem(RATING_UNDERDOG_MIN_GAP_KEY, String(n)); set({ underdogMinGap: n }) },
  setUnderdogBoostPct: (n) => { localStorage.setItem(RATING_UNDERDOG_BOOST_PCT_KEY, String(n)); set({ underdogBoostPct: n }) },
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
  toggleCarouselFloatingPanel: () => {
    const next = !get().carouselFloatingPanel
    localStorage.setItem(CAROUSEL_FLOATING_PANEL_KEY, String(next))
    set({ carouselFloatingPanel: next })
  },
  setCarouselNavSide: (side) => {
    localStorage.setItem(CAROUSEL_NAV_SIDE_KEY, side)
    set({ carouselNavSide: side })
  },
  hydrate: () => {
    if (loadBool('hydrus-dark-mode')) document.documentElement.classList.add('dark')
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
  addToRatingsCache: (entries) => {
    const cache = loadRatingsCacheFromStorage() ?? new Map<number, Record<string, number | boolean>>()
    for (const [id, ratings] of entries) {
      cache.set(id, ratings)
    }
    saveRatingsCacheToStorage(cache)
  },
}))
