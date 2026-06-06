import { create } from 'zustand'
import type { RatingService } from '../api/types'
import { fetchRatingServices } from '../api/services'

interface RatingServicesState {
  services: RatingService[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
}

export const useRatingServicesStore = create<RatingServicesState>((set) => ({
  services: [],
  loading: false,
  error: null,
  load: async () => {
    set({ loading: true, error: null })
    try {
      const services = await fetchRatingServices()
      set({ services, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },
}))
