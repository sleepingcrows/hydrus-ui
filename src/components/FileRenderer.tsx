import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { readPsd } from 'ag-psd'

type FileRendererProps = {
  url: string
  mime: string
  className?: string
}

function isSwf(mime: string): boolean {
  return mime === 'application/x-shockwave-flash' || mime === 'application/x-shockwave-flash2-preview'
}

function isPdf(mime: string): boolean {
  return mime === 'application/pdf'
}

function isPsd(mime: string): boolean {
  return mime === 'image/vnd.adobe.photoshop' || mime === 'application/x-photoshop' || mime === 'image/psd'
}

function isAudio(mime: string): boolean {
  return mime.startsWith('audio/')
}

function isImage(mime: string): boolean {
  return mime.startsWith('image/')
}

function isVideo(mime: string): boolean {
  return mime.startsWith('video/')
}

function isText(mime: string): boolean {
  return mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml' || mime === 'application/javascript'
}

function SwfPlayer({ url, className }: { url: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let destroyed = false
    let player: any = null

    async function init() {
      const { default: Ruffle } = await import('@ruffle-rs/ruffle')
      if (destroyed || !containerRef.current) return
      const ruffle = Ruffle as any
      player = new ruffle.RufflePlayer()
      containerRef.current.innerHTML = ''
      containerRef.current.appendChild(player)
      player.load({ url, allowFullscreen: true })
    }
    init()

    return () => {
      destroyed = true
      player?.destroy?.()
    }
  }, [url])

  return (
    <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }} />
  )
}

function PdfViewer({ url, className }: { url: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pageCount, setPageCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()
  }, [])

  useEffect(() => {
    let cancelled = false
    async function render() {
      if (!canvasRef.current) return
      try {
        const doc = await pdfjsLib.getDocument(url).promise
        if (cancelled) return
        setPageCount(doc.numPages)
        const page = await doc.getPage(currentPage)
        if (cancelled) return
        const viewport = page.getViewport({ scale: 1.5 })
        const canvas = canvasRef.current
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        await page.render({ canvasContext: ctx, viewport }).promise
      } catch (e) {
        console.warn('PDF render failed:', e)
      }
    }
    render()
    return () => { cancelled = true }
  }, [url, currentPage])

  return (
    <div className={`flex flex-col items-center ${className ?? ''}`}>
      <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
      {pageCount > 1 && (
        <div className="flex items-center gap-2 mt-1 text-xs text-white/60">
          <button
            className="px-2 py-0.5 bg-white/10 rounded hover:bg-white/20 disabled:opacity-30"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >‹</button>
          <span>{currentPage} / {pageCount}</span>
          <button
            className="px-2 py-0.5 bg-white/10 rounded hover:bg-white/20 disabled:opacity-30"
            disabled={currentPage >= pageCount}
            onClick={() => setCurrentPage((p) => p + 1)}
          >›</button>
        </div>
      )}
    </div>
  )
}

function PsdViewer({ url, className }: { url: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function render() {
      if (!canvasRef.current) return
      try {
        const resp = await fetch(url)
        const buffer = await resp.arrayBuffer()
        if (cancelled) return
        const psd = readPsd(buffer, { skipCompositeImageData: false, skipLayerImageData: true, skipThumbnail: true })
        if (cancelled || !psd.canvas) return
        const srcCanvas = psd.canvas
        const destCanvas = canvasRef.current
        destCanvas.width = srcCanvas.width
        destCanvas.height = srcCanvas.height
        const ctx = destCanvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(srcCanvas, 0, 0)
      } catch (e) {
        if (!cancelled) {
          console.warn('PSD render failed:', e)
          setError(true)
        }
      }
    }
    render()
    return () => { cancelled = true }
  }, [url])

  if (error) {
    return (
      <div className={`flex items-center justify-center text-sm text-white/50 ${className ?? ''}`}>
        Failed to render PSD
      </div>
    )
  }

  return <canvas ref={canvasRef} className={`max-w-full max-h-full object-contain ${className ?? ''}`} />
}

export function FileRenderer({ url, mime, className }: FileRendererProps) {
  if (isVideo(mime)) {
    return <video src={url} className={className} controls autoPlay loop />
  }

  if (isSwf(mime)) {
    return <SwfPlayer url={url} className={className} />
  }

  if (isPdf(mime)) {
    return <PdfViewer url={url} className={className} />
  }

  if (isPsd(mime)) {
    return <PsdViewer url={url} className={className} />
  }

  if (isAudio(mime)) {
    return (
      <div className={`flex items-center justify-center ${className ?? ''}`}>
        <audio src={url} controls autoPlay className="w-full max-w-md" />
      </div>
    )
  }

  if (isText(mime)) {
    return (
      <iframe
        src={url}
        className={className}
        title="File preview"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    )
  }

  if (isImage(mime)) {
    return <img src={url} alt="" className={className} />
  }

  return (
    <div className={`flex items-center justify-center text-sm text-white/50 ${className ?? ''}`}>
      Unsupported file type: {mime}
    </div>
  )
}