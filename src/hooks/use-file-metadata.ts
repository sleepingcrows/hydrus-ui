import { useQuery } from '@tanstack/react-query'
import { fetchFileMetadata, fetchFileMetadataByIds } from '../api/search'

export function useFilesMetadata(hashes: string[]) {
  return useQuery({
    queryKey: ['file-metadata', hashes],
    queryFn: () => fetchFileMetadata(hashes),
    enabled: hashes.length > 0,
    staleTime: 60_000,
  })
}

export function useFilesMetadataByIds(file_ids: number[]) {
  return useQuery({
    queryKey: ['file-metadata-by-ids', file_ids],
    queryFn: () => fetchFileMetadataByIds(file_ids),
    enabled: file_ids.length > 0,
    staleTime: 60_000,
  })
}
