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
  hydrate: () => void
  rebuildRatingsCache: (tags: string[]) => Promise<void>
  getRatingsCache: () => Map<number, Record<string, number | boolean>> | null
  addToRatingsCache: (entries: Iterable<[number, Record<string, number | boolean>]>) => void
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
  terminatedMode: false,
  smashPassTags: [],
  smashPassTagsB: [],
  smashPassDualMode: false,
  searchHistory: [],
  ratingBaseInc: 5,
  ratingLoserDec: 2,
  ratingStreakThreshold: 3,
  ratingStreakBonus: 1,
  underdogThreshold: 5,
  underdogMinGap: 20,
  underdogBoostPct: 75,
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
  hydrate: () => {
    const dark = localStorage.getItem('hydrus-dark-mode') === 'true'
    if (dark) document.documentElement.classList.add('dark')
    const staticMode = localStorage.getItem(SMASH_PASS_STATIC_KEY) === 'true'
    const termMode = localStorage.getItem(TERMINATED_MODE_KEY) === 'true'
    const tagsRaw = localStorage.getItem(SMASH_PASS_TAGS_KEY)
    const smashPassTags: string[] = tagsRaw ? (() => { try { return JSON.parse(tagsRaw) } catch { return [] } })() : []
    const tagsBRaw = localStorage.getItem(SMASH_PASS_TAGS_B_KEY)
    const smashPassTagsB: string[] = tagsBRaw ? (() => { try { return JSON.parse(tagsBRaw) } catch { return [] } })() : []
    const dualMode = localStorage.getItem(SMASH_PASS_DUAL_KEY) === 'true'
    const searchHistoryRaw = localStorage.getItem(SEARCH_HISTORY_KEY)
    const searchHistory: string[][] = searchHistoryRaw ? (() => { try { return JSON.parse(searchHistoryRaw) } catch { return [] } })() : []
    const ratingSvcKey = localStorage.getItem(RATING_SERVICE_KEY) || ''
    const likeSvcKey = localStorage.getItem(LIKE_SERVICE_KEY) || ''
    const galleryLayout = (localStorage.getItem(GALLERY_LAYOUT_KEY) as GalleryLayoutMode) || 'grid'
    const ratingBaseInc = Number(localStorage.getItem(RATING_BASE_INC_KEY)) || 5
    const ratingLoserDec = Number(localStorage.getItem(RATING_LOSER_DEC_KEY)) || 2
    const ratingStreakThreshold = Number(localStorage.getItem(RATING_STREAK_THRESHOLD_KEY)) || 3
    const ratingStreakBonus = Number(localStorage.getItem(RATING_STREAK_BONUS_KEY)) || 1
    const underdogThreshold = Number(localStorage.getItem(RATING_UNDERDOG_THRESHOLD_KEY)) || 5
    const underdogMinGap = Number(localStorage.getItem(RATING_UNDERDOG_MIN_GAP_KEY)) || 20
    const underdogBoostPct = Number(localStorage.getItem(RATING_UNDERDOG_BOOST_PCT_KEY)) || 75
    set({ darkMode: dark, smashPassStaticMode: staticMode, terminatedMode: termMode, smashPassTags, smashPassTagsB, smashPassDualMode: dualMode, searchHistory, ratingServiceKey: ratingSvcKey, likeServiceKey: likeSvcKey, galleryLayoutMode: galleryLayout, ratingBaseInc, ratingLoserDec, ratingStreakThreshold, ratingStreakBonus, underdogThreshold, underdogMinGap, underdogBoostPct })
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
