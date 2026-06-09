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

function isAvi(mime: string): boolean {
  return mime === 'video/x-msvideo' || mime === 'video/avi'
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

export function isUnsupportedMime(mime: string): boolean {
  return isAvi(mime)
    || (!isVideo(mime) && !isSwf(mime) && !isPdf(mime) && !isPsd(mime) && !isAudio(mime) && !isText(mime) && !isImage(mime))
}

function SwfPlayer({ url, className }: { url: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const w = window as any
      if (!w.RufflePlayer) w.RufflePlayer = { config: {} }
      w.RufflePlayer.config = w.RufflePlayer.config ?? {}
      w.RufflePlayer.config.publicPath = '/'
      try {
        await import('@ruffle-rs/ruffle')
      } catch (err) {
        console.error('Failed to load Ruffle:', err)
        return
      }
      if (cancelled) return
      await new Promise<void>(r => setTimeout(r, 0))
      if (cancelled) return
      const rp = w.RufflePlayer
      const source = rp?.local?.() ?? rp?.newest?.() ?? rp?.sources?.local
      if (!source?.createPlayer) {
        console.warn('RufflePlayer source not available')
        return
      }
      const el = source.createPlayer()
      if (cancelled || !containerRef.current) return
      el.style.width = '100%'
      el.style.height = '100%'
      containerRef.current.innerHTML = ''
      containerRef.current.appendChild(el)
      playerRef.current = el
      el.load({ url })
    }
    init()

    return () => {
      playerRef.current?.destroy?.()
    }
  }, [url])

  return (
    <div
      className={className}
      style={{ width: '100%', height: '100%' }}
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

function PdfViewer({ url, className }: { url: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pageCount, setPageCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [badSig, setBadSig] = useState(false)

  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()
  }, [])

  useEffect(() => {
    if (!url) return
    let cancelled = false
    async function render() {
      if (!canvasRef.current) return
      try {
        const sigResp = await fetch(url, { headers: { Range: 'bytes=0-3' } })
        if (sigResp.ok && sigResp.status === 206) {
          const sigBuf = await sigResp.arrayBuffer()
          const sig = String.fromCharCode(...new Uint8Array(sigBuf))
          if (sig !== '%PDF') {
            console.warn('PDF render failed: invalid magic bytes', sig)
            setBadSig(true)
            return
          }
        }
        const doc = await pdfjsLib.getDocument({ url }).promise
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

  function handleWheel(e: React.WheelEvent) {
    if (pageCount <= 1) return
    if (e.deltaY > 0 && currentPage < pageCount) { setCurrentPage((p) => p + 1); e.preventDefault() }
    else if (e.deltaY < 0 && currentPage > 1) { setCurrentPage((p) => p - 1); e.preventDefault() }
  }

  return (
    <div className={`flex flex-col items-center ${className ?? ''}`} onWheel={handleWheel}>
      {badSig ? (
        <div className="flex items-center justify-center text-sm text-white/50 p-4">Unsupported file type</div>
      ) : (
        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
      )}
      {pageCount > 1 && (
        <div className="flex items-center gap-2 mt-1 text-xs text-white/60">
          <button
            className="min-h-[44px] min-w-[44px] px-2 py-0.5 bg-white/10 rounded hover:bg-white/20 active:bg-white/30 disabled:opacity-30"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >‹</button>
          <span>{currentPage} / {pageCount}</span>
          <button
            className="min-h-[44px] min-w-[44px] px-2 py-0.5 bg-white/10 rounded hover:bg-white/20 active:bg-white/30 disabled:opacity-30"
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
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
  const fallbackUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function render() {
      if (!canvasRef.current) return
      try {
        const resp = await fetch(url)
        const buffer = await resp.arrayBuffer()
        if (cancelled) return
        const view = new Uint8Array(buffer, 0, 4)
        const sig = String.fromCharCode(view[0], view[1], view[2], view[3])
        if (sig !== '8BPS') {
          const blob = new Blob([buffer], { type: 'image/png' })
          const objUrl = URL.createObjectURL(blob)
          if (!cancelled) {
            if (fallbackUrlRef.current) URL.revokeObjectURL(fallbackUrlRef.current)
            fallbackUrlRef.current = objUrl
            setFallbackUrl(objUrl)
          } else {
            URL.revokeObjectURL(objUrl)
          }
          return
        }
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
    return () => {
      cancelled = true
      if (fallbackUrlRef.current) {
        URL.revokeObjectURL(fallbackUrlRef.current)
        fallbackUrlRef.current = null
      }
    }
  }, [url])

  if (fallbackUrl) {
    return <img src={fallbackUrl} alt="" className={`max-w-full max-h-full object-contain ${className ?? ''}`} />
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center text-sm text-white/50 ${className ?? ''}`}>
        Failed to render PSD
      </div>
    )
  }

  return <canvas ref={canvasRef} className={`max-w-full max-h-full object-contain ${className ?? ''}`} />
}

function InteractiveMedia({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={className}
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

function UnsupportedFile({ url, mime, className }: { url: string; mime: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-sm text-white/50 ${className ?? ''}`}>
      <span>Unsupported file type: {mime}</span>
      <a
        href={url}
        download
        className="min-h-[44px] px-3 py-1.5 bg-white/10 rounded hover:bg-white/20 active:bg-white/30 transition-colors text-white/70 text-xs"
      >
        Download file
      </a>
    </div>
  )
}

export function FileRenderer({ url, mime, className }: FileRendererProps) {
  if (isAvi(mime)) {
    return <UnsupportedFile url={url} mime={mime} className={className} />
  }

  if (isVideo(mime)) {
    return (
      <InteractiveMedia className={className}>
        <video src={url} controls autoPlay loop className="w-full h-full object-contain" />
      </InteractiveMedia>
    )
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
      <InteractiveMedia className={`flex items-center justify-center ${className ?? ''}`}>
        <audio src={url} controls autoPlay className="w-full max-w-md" />
      </InteractiveMedia>
    )
  }

  if (isText(mime)) {
    return (
      <InteractiveMedia>
        <iframe
          src={url}
          title="File preview"
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </InteractiveMedia>
    )
  }

  if (isImage(mime)) {
    return <img src={url} alt="" className={className} />
  }

  return <UnsupportedFile url={url} mime={mime} className={className} />
}