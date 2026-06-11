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
    width: 1024,
    margin: 4,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#ffffff' },
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
  const maxDim = 1500
  let w = img.naturalWidth
  let h = img.naturalHeight
  if (w > maxDim || h > maxDim) {
    const scale = Math.min(maxDim / w, maxDim / h)
    w = Math.round(w * scale); h = Math.round(h * scale)
  }
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, 0, 0, w, h)
  const imageData = ctx.getImageData(0, 0, w, h)
  const result = jsQR(imageData.data, imageData.width, imageData.height)
  if (!result) throw new Error('No QR code found in image')
  return JSON.parse(result.data) as ExportData
}

export async function scanQRFromCamera(): Promise<ExportData> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera requires HTTPS or localhost — use file import instead')

  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
  const video = document.createElement('video')
  video.srcObject = stream
  video.setAttribute('playsinline', '')
  video.play()

  try {
    const data = await new Promise<ExportData>((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not available')); return }

      let animId = 0
      function tick() {
        if (video.videoWidth === 0 || video.videoHeight === 0) { animId = requestAnimationFrame(tick); return }
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const result = jsQR(imageData.data, imageData.width, imageData.height)
        if (result) {
          try {
            resolve(JSON.parse(result.data) as ExportData)
          } catch { /* continue scanning */ }
        }
        animId = requestAnimationFrame(tick)
      }
      tick()

      setTimeout(() => { cancelAnimationFrame(animId); reject(new Error('Scan timed out')) }, 30000)
    })
    return data
  } finally {
    for (const track of stream.getTracks()) track.stop()
  }
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
