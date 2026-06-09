import { api } from './client'

export interface TagAction {
  tag: string
  action: 'add' | 'delete' | 'pend' | 'petition' | 'rescind_pend' | 'rescind_petition'
}

export async function addTags(
  identifier: { hash: string } | { file_id: number },
  service_key_to_actions_to_tags: Record<string, Record<string, string[]>>,
) {
  return api.post<unknown>('/add_tags/add_tags', {
    ...identifier,
    service_keys_to_actions_to_tags: service_key_to_actions_to_tags,
  })
}

export async function searchTags(query: string): Promise<string[]> {
  const data = await api.get<{ tags: unknown[] }>('/add_tags/search_tags', { search: query })
  if (!data.tags) return []
  return data.tags.map((t) => {
    if (typeof t === 'string') return t
    if (t && typeof t === 'object' && 'value' in t) return (t as { value: string }).value
    return String(t)
  })
}

export async function cleanTags(tags: string[]): Promise<string[]> {
  const data = await api.get<{ tags: string[] }>('/add_tags/clean_tags', { tags: JSON.stringify(tags) })
  return data.tags || []
}
