import { api } from './client'

export async function setRating(
  payload: {
    file_id?: number
    hash?: string
    rating_service_key: string
    rating: boolean | number | null | undefined
  }
) {
  return api.post<unknown>('/edit_ratings/set_rating', payload)
}
