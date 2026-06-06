import { create } from 'zustand'
import type { HotkeyConfig, HotkeyBinding } from '../api/types'

const HOTKEY_STORAGE_KEY = 'hydrus-hotkey-config'
const SMASH_PASS_STATIC_KEY = 'hydrus-smashpass-static'

const DEFAULT_HOTKEYS: HotkeyConfig = {
  version: 1,
  bindings: {
    'gallery-next': { key: 'j', scope: 'gallery' },
    'gallery-prev': { key: 'k', scope: 'gallery' },
    'gallery-first': { key: 'Home', scope: 'gallery' },
    'gallery-last': { key: 'End', scope: 'gallery' },
    'toggle-fullscreen': { key: 'f', scope: 'global' },
    'toggle-info': { key: 'i', scope: 'gallery' },
    'focus-search': { key: '/', scope: 'global' },
    'smash': { key: ' ', scope: 'smash-pass' },
    'pass': { key: 'a', scope: 'smash-pass' },
    'skip': { key: 'x', scope: 'smash-pass' },
    'archive': { key: 'Enter', scope: 'gallery' },
    'delete-file': { key: 'Delete', scope: 'gallery' },
    'show-cheatsheet': { key: '?', scope: 'global' },
    'toggle-dark': { key: 'd', scope: 'global' },
  },
}

interface SettingsState {
  darkMode: boolean
  hotkeys: HotkeyConfig
  smashPassStaticMode: boolean
  toggleDark: () => void
  toggleSmashPassStatic: () => void
  setHotkey: (actionId: string, binding: HotkeyBinding) => void
  resetHotkeys: () => void
  hydrate: () => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  darkMode: false,
  hotkeys: { ...DEFAULT_HOTKEYS },
  smashPassStaticMode: false,
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
  setHotkey: (actionId, binding) => {
    const hotkeys = get().hotkeys
    const updated = { ...hotkeys, bindings: { ...hotkeys.bindings, [actionId]: binding } }
    localStorage.setItem(HOTKEY_STORAGE_KEY, JSON.stringify(updated))
    set({ hotkeys: updated })
  },
  resetHotkeys: () => {
    localStorage.setItem(HOTKEY_STORAGE_KEY, JSON.stringify(DEFAULT_HOTKEYS))
    set({ hotkeys: { ...DEFAULT_HOTKEYS } })
  },
  hydrate: () => {
    const dark = localStorage.getItem('hydrus-dark-mode') === 'true'
    if (dark) document.documentElement.classList.add('dark')
    const saved = localStorage.getItem(HOTKEY_STORAGE_KEY)
    const staticMode = localStorage.getItem(SMASH_PASS_STATIC_KEY) === 'true'
    if (saved) {
      try {
        set({ hotkeys: JSON.parse(saved), darkMode: dark, smashPassStaticMode: staticMode })
      } catch {
        set({ hotkeys: { ...DEFAULT_HOTKEYS }, darkMode: dark, smashPassStaticMode: staticMode })
      }
    } else {
      set({ darkMode: dark, smashPassStaticMode: staticMode })
    }
  },
}))
