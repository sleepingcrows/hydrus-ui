import { create } from 'zustand'
import { setConnection, clearConnection, getConnection } from '../api/client'
import { clearCachedServices } from '../api/services'

interface ApiState {
  url: string
  key: string
  connected: boolean
  setApiKey: (url: string, key: string) => void
  disconnect: () => void
  hydrate: () => void
}

export const useApiStore = create<ApiState>((set) => ({
  url: '',
  key: '',
  connected: false,
  setApiKey: (url: string, key: string) => {
    setConnection(url, key)
    set({ url, key, connected: true })
  },
  disconnect: () => {
    clearConnection()
    clearCachedServices()
    set({ url: '', key: '', connected: false })
  },
  hydrate: () => {
    const { url, key } = getConnection()
    if (url && key) set({ url, key, connected: true })
  },
}))
