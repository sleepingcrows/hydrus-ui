import { api } from './client'

export interface IncrementFileViewtimePayload {
  file_id?: number
  hash?: string
  canvas_type?: number
  timestamp?: number
  views?: number
  viewtime: number
}

export interface SetFileViewtimePayload {
  file_id?: number
  hash?: string
  canvas_type?: number
  timestamp?: number
  views: number
  viewtime: number
}

export async function incrementFileViewtime(payload: IncrementFileViewtimePayload) {
  return api.post<unknown>('/edit_times/increment_file_viewtime', payload)
}

export async function setFileViewtime(payload: SetFileViewtimePayload) {
  return api.post<unknown>('/edit_times/set_file_viewtime', payload)
}
