import { create } from 'zustand'
import { fetchServices } from '../api/services'
import { SERVICE_TYPE } from '../api/types'
import type { Service } from '../api/types'

interface TagServicesState {
  services: Service[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
}

const TAG_SERVICE_TYPES = new Set([
  SERVICE_TYPE.TAG_REPO,
  SERVICE_TYPE.LOCAL_TAGS,
  SERVICE_TYPE.ALL_KNOWN_TAGS,
])

export const useTagServicesStore = create<TagServicesState>((set) => ({
  services: [],
  loading: false,
  error: null,
  load: async () => {
    set({ loading: true, error: null })
    try {
      const all = await fetchServices()
      const tagServices = all.filter((s) => TAG_SERVICE_TYPES.has(s.type))
      set({ services: tagServices, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },
}))
