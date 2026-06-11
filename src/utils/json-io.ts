export interface ExportData {
  version: 1
  bookmarks: { name: string; tags: string[]; sortType: number; sortAsc: boolean; limit: number }[]
  searchHistory: string[][]
  settings: {
    ratingServiceKey: string
    likeServiceKey: string
    ratingBaseInc: number
    ratingLoserDec: number
    ratingStreakThreshold: number
    ratingStreakBonus: number
    underdogThreshold: number
    underdogMinGap: number
    underdogBoostPct: number
    searchAutoSubmit: boolean
    smashPassStaticMode: boolean
    smashPassTags: string[]
    smashPassTagsB: string[]
    smashPassDualMode: boolean
    terminatedMode: boolean
    smashPassSwipeVote: boolean
    galleryLayoutMode: string
    carouselFloatingPanel: boolean
    carouselNavSide: string
    smashFloatingPanel: boolean
    smashNavSide: string
  }
}

export function exportToJSON(data: ExportData): Blob {
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}

export async function importFromJSON(file: File): Promise<ExportData> {
  const text = await file.text()
  return JSON.parse(text) as ExportData
}
