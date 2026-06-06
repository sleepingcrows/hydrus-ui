import { create } from 'zustand'

const SMASH_PASS_STATIC_KEY = 'hydrus-smashpass-static'
const SMASH_PASS_TAGS_KEY = 'hydrus-smashpass-tags'
const RATING_SERVICE_KEY = 'hydrus-rating-service-key'
const LIKE_SERVICE_KEY = 'hydrus-like-service-key'
const GALLERY_LAYOUT_KEY = 'hydrus-gallery-layout'

type GalleryLayoutMode = 'grid' | 'mosaic'

interface SettingsState {
  darkMode: boolean
  smashPassStaticMode: boolean
  smashPassTags: string[]
  ratingServiceKey: string
  likeServiceKey: string
  galleryLayoutMode: GalleryLayoutMode
  toggleDark: () => void
  toggleSmashPassStatic: () => void
  setSmashPassTags: (tags: string[]) => void
  setRatingServiceKey: (key: string) => void
  setLikeServiceKey: (key: string) => void
  setGalleryLayoutMode: (mode: GalleryLayoutMode) => void
  hydrate: () => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  darkMode: false,
  smashPassStaticMode: false,
  smashPassTags: [],
  ratingServiceKey: '',
  likeServiceKey: '',
  galleryLayoutMode: 'grid',
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
}))
