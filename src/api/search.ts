import { api } from './client'
import { SearchFilesResponseSchema, FileMetadataResponseSchema, type FileMetadata } from './types'

export interface SearchOptions {
  tags: string[]
  file_service_key?: string
  tag_service_key?: string
  file_sort_type?: number
  file_sort_asc?: boolean
  return_hashes?: boolean
  file_limit?: number
}

export async function searchFiles(opts: SearchOptions): Promise<{ file_ids?: number[]; hashes?: string[] }> {
  const params: Record<string, string> = {
    tags: api.jsonEncodeForGet(opts.tags),
  }
  if (opts.file_service_key) params.file_service_key = opts.file_service_key
  if (opts.tag_service_key) params.tag_service_key = opts.tag_service_key
  if (opts.file_sort_type !== undefined) params.file_sort_type = String(opts.file_sort_type)
  if (opts.file_sort_asc !== undefined) params.file_sort_asc = String(opts.file_sort_asc)
  if (opts.return_hashes) params.return_hashes = 'true'
  if (opts.file_limit !== undefined) params.file_limit = String(opts.file_limit)
  const data = await api.get<unknown>('/get_files/search_files', params)
  return SearchFilesResponseSchema.parse(data)
}

const CHUNK_SIZE = 100
const METADATA_CONCURRENCY = 5

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

async function batchFetch<T>(
  chunks: T[][],
  fn: (chunk: T[]) => Promise<unknown>,
): Promise<unknown[][]> {
  const results: unknown[][] = []
  for (let i = 0; i < chunks.length; i += METADATA_CONCURRENCY) {
    const batch = chunks.slice(i, i + METADATA_CONCURRENCY)
    const batchResults = await Promise.all(batch.map((chunk) => fn(chunk)))
    results.push(...batchResults)
  }
  return results
}

export async function fetchFileMetadata(hashes: string[]): Promise<FileMetadata[]> {
  if (hashes.length === 0) return []
  const chunks = chunkArray(hashes, CHUNK_SIZE)
  const results = await batchFetch(chunks, (chunk) =>
    api.get<unknown>('/get_files/file_metadata', { hashes: api.jsonEncodeForGet(chunk) })
  )
  return results.flatMap((data) => FileMetadataResponseSchema.parse(data).metadata)
}

export async function fetchFileMetadataByIds(file_ids: number[]): Promise<FileMetadata[]> {
  if (file_ids.length === 0) return []
  const chunks = chunkArray(file_ids, CHUNK_SIZE)
  const results = await batchFetch(chunks, (chunk) =>
    api.get<unknown>('/get_files/file_metadata', { file_ids: api.jsonEncodeForGet(chunk) })
  )
  return results.flatMap((data) => FileMetadataResponseSchema.parse(data).metadata)
}

export async function getThumbnailUrl(hash: string): Promise<string> {
  const blob = await api.getBinary('/get_files/thumbnail', { hash })
  return URL.createObjectURL(blob)
}

export async function getFileUrl(hash: string): Promise<string> {
  const blob = await api.getBinary('/get_files/file', { hash })
  return URL.createObjectURL(blob)
}
