import { searchFiles, fetchFileMetadataByIds } from '../../api/search'
import { setRating } from '../../api/ratings'
import type { FileMetadata } from '../../api/types'

export interface TagElo {
  tag: string
  avgElo: number
  fileCount: number
}

export interface CandidateFile {
  fileId: number
  hash: string
  predictedElo: number
  confidenceScore: number
  tagCount: number
  tags: string[]
}

function getAllKnownTags(file: FileMetadata): string[] {
  if (!file.tags) return []
  for (const entry of Object.values(file.tags)) {
    if (entry.type === 10) return entry.display_tags?.['0'] ?? []
  }
  return []
}

export async function computeTagElos(
  ratingServiceKey: string,
  onProgress?: (current: number, total: number) => void,
): Promise<TagElo[]> {
  const result = await searchFiles({
    tags: ['system:has count for skill'],
    file_limit: 10000,
    return_hashes: false,
  })
  const ids = result.file_ids ?? []
  if (ids.length === 0) return []

  const tagMap = new Map<string, { sum: number; count: number }>()
  const totalFiles = ids.length

  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500)
    const meta = await fetchFileMetadataByIds(chunk)
    for (const file of meta) {
      const elo = file.ratings?.[ratingServiceKey]
      if (typeof elo !== 'number' || elo === 0) continue

      const tags = getAllKnownTags(file)
      for (const tag of tags) {
        const entry = tagMap.get(tag) ?? { sum: 0, count: 0 }
        entry.sum += elo
        entry.count++
        tagMap.set(tag, entry)
      }
    }
    onProgress?.(Math.min(i + 500, totalFiles), totalFiles)
  }

  const tagElos: TagElo[] = []
  for (const [tag, { sum, count }] of tagMap) {
    if (count < 2) continue
    tagElos.push({ tag, avgElo: Math.round(sum / count), fileCount: count })
  }

  return tagElos.sort((a, b) => b.fileCount - a.fileCount)
}

export async function findCandidateFiles(
  tagFilter: string[],
  tagElos: Map<string, TagElo>,
  ratingServiceKey: string,
  onProgress?: (current: number, total: number) => void,
): Promise<CandidateFile[]> {
  const tags = tagFilter.length > 0 ? tagFilter : ['system:everything']
  const searchResult = await searchFiles({
    tags,
    file_limit: 10000,
    return_hashes: true,
  })
  const ids = searchResult.file_ids ?? []
  if (ids.length === 0) return []

  const candidates: CandidateFile[] = []
  const totalFiles = ids.length

  for (let i = 0; i < ids.length; i += 500) {
    const chunkIds = ids.slice(i, i + 500)
    const meta = await fetchFileMetadataByIds(chunkIds)
    for (const file of meta) {
      const existingElo = file.ratings?.[ratingServiceKey]
      if (typeof existingElo === 'number' && existingElo > 0) continue

      const fileTags = getAllKnownTags(file)
      if (fileTags.length === 0) continue

      let sumElo = 0
      let matchCount = 0
      let totalConfidence = 0

      for (const tag of fileTags) {
        const elo = tagElos.get(tag)
        if (elo) {
          sumElo += elo.avgElo
          matchCount++
          totalConfidence += elo.fileCount
        }
      }

      if (matchCount === 0) continue

      candidates.push({
        fileId: file.file_id,
        hash: file.hash,
        predictedElo: Math.round(sumElo / matchCount),
        confidenceScore: totalConfidence,
        tagCount: matchCount,
        tags: fileTags,
      })
    }
    onProgress?.(Math.min(i + 500, totalFiles), totalFiles)
  }

  return candidates.sort((a, b) => b.confidenceScore - a.confidenceScore)
}

export async function applyCandidateRatings(
  fileIds: number[],
  predictedElo: number,
  ratingServiceKey: string,
  onProgress?: (applied: number, total: number) => void,
): Promise<void> {
  for (let i = 0; i < fileIds.length; i++) {
    await setRating({
      file_id: fileIds[i],
      rating_service_key: ratingServiceKey,
      rating: predictedElo,
    })
    onProgress?.(i + 1, fileIds.length)
  }
}

export async function applyCandidateRatingsBatch(
  candidates: { fileId: number; predictedElo: number }[],
  ratingServiceKey: string,
  onProgress?: (applied: number, total: number) => void,
): Promise<void> {
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    await setRating({
      file_id: c.fileId,
      rating_service_key: ratingServiceKey,
      rating: c.predictedElo,
    })
    onProgress?.(i + 1, candidates.length)
  }
}
