import QRCode from 'qrcode'
import jsQR from 'jsqr'

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

export async function exportToQR(data: ExportData): Promise<Blob> {
  const json = JSON.stringify(data)
  const canvas = document.createElement('canvas')
  await QRCode.toCanvas(canvas, json, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
  })
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b)
      else reject(new Error('Failed to generate PNG'))
    }, 'image/png')
  })
}

export async function importFromQR(file: File): Promise<ExportData> {
  const img = await loadImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const result = jsQR(imageData.data, imageData.width, imageData.height)
  if (!result) throw new Error('No QR code found in image')
  return JSON.parse(result.data) as ExportData
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
    img.src = url
  })
}
