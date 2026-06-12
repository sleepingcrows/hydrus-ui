import { z } from 'zod'

export const ServiceSchema = z.object({
  name: z.string(),
  service_key: z.string(),
  type: z.number(),
  type_pretty: z.string(),
  star_shape: z.string().optional(),
  min_stars: z.number().optional(),
  max_stars: z.number().optional(),
  allows_zero: z.boolean().optional(),
  show_in_thumbnail: z.boolean().optional(),
  show_in_thumbnail_even_when_null: z.boolean().optional(),
  colours: z.any().optional(),
})
export type Service = z.infer<typeof ServiceSchema>

export const ServicesResponseSchema = z.object({
  services_v2: z.array(ServiceSchema),
})
export type ServicesResponse = z.infer<typeof ServicesResponseSchema>

export const FileViewingStatisticsSchema = z.object({
  canvas_type: z.number(),
  views: z.number(),
  viewtime: z.number(),
})
export type FileViewingStatistics = z.infer<typeof FileViewingStatisticsSchema>

export const FileMetadataSchema = z.object({
  file_id: z.number(),
  hash: z.string(),
  size: z.number(),
  mime: z.string(),
  ext: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  duration: z.number().nullish(),
  has_audio: z.boolean().optional(),
  has_exif: z.boolean().optional(),
  is_inbox: z.boolean().optional(),
  is_local: z.boolean().optional(),
  file_services: z.record(z.string(), z.any()).optional(),
  tags: z.record(z.string(), z.object({
    name: z.string(),
    type: z.number(),
    storage_tags: z.record(z.string(), z.array(z.string())),
    display_tags: z.record(z.string(), z.array(z.string())),
  })).optional(),
  ratings: z.record(z.string(), z.union([z.number(), z.boolean(), z.null()])).optional(),
  time_imported: z.number().optional(),
  file_urls: z.array(z.string()).optional(),
  file_viewing_statistics: z.array(FileViewingStatisticsSchema).optional(),
})
export type FileMetadata = z.infer<typeof FileMetadataSchema>

export const FileMetadataResponseSchema = z.object({
  metadata: z.array(FileMetadataSchema),
})

export const SearchFilesResponseSchema = z.object({
  file_ids: z.array(z.number()).optional(),
  hashes: z.array(z.string()).optional(),
})

export const TagSearchResponseSchema = z.object({
  tags: z.array(z.object({ value: z.string(), count: z.number() })),
})
export type TagSearchResponse = z.infer<typeof TagSearchResponseSchema>

export const VerifyAccessResponseSchema = z.object({
  name: z.string(),
  basic_permissions: z.array(z.number()),
  human_description: z.string(),
})

export const ApiVersionResponseSchema = z.object({
  version: z.number(),
  hydrus_version: z.number(),
})

export const SERVICE_TYPE = {
  TAG_REPO: 0,
  FILE_REPO: 1,
  LOCAL_FILES: 2,
  LOCAL_TAGS: 5,
  NUMERICAL_RATING: 6,
  LIKE_DISLIKE_RATING: 7,
  ALL_KNOWN_TAGS: 10,
  ALL_KNOWN_FILES: 11,
  TRASH: 14,
  LOCAL_STORAGE: 15,
  COMBINED_MEDIA: 21,
  INC_DEC_RATING: 22,
} as const

export const RATING_SERVICE_TYPES: ReadonlySet<number> = new Set([
  SERVICE_TYPE.NUMERICAL_RATING,
  SERVICE_TYPE.LIKE_DISLIKE_RATING,
  SERVICE_TYPE.INC_DEC_RATING,
])

// Hydrus API file_sort_type enum:
// 0 file size, 1 duration, 2 import time, 3 filetype, 4 random,
// 5 width, 6 height, 7 ratio, 8 num pixels, ...
export const FILE_SORT_TYPES = {
  FILE_SIZE: 0,
  IMPORT_TIME: 2,
  DURATION: 1,
  NUMBER_OF_PIXELS: 8,
  HASH: 20,
  RANDOM: 4,
} as const

export interface RatingService extends Service {
  type: 6 | 7 | 22
}

export function isRatingService(s: Service): s is RatingService {
  return RATING_SERVICE_TYPES.has(s.type)
}

export interface TagRatingRecord {
  id: string
  tag: string
  rating_service_key: string
  file_hash: string
  mu_before: number
  mu_after: number
  sigma_before: number
  sigma_after: number
  action: 'smash' | 'pass' | 'skip'
  timestamp: number
}

export interface FileRatingRecord {
  file_id: number
  file_hash: string
  mu: number
  sigma: number
  synced_rating?: number
  timestamp: number
}

export interface TagStats {
  tag: string
  count: number
  smash_count: number
  pass_count: number
  ratio: number
  current_mu: number
  current_sigma: number
  current_rating: number
  history: Array<{ mu: number; sigma: number; timestamp: number }>
}

export interface TagPreference {
  tag: string
  weight: number
  appearances: number
  avg_mu_change: number
  smash_count: number
  pass_count: number
}
