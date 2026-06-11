import { useEffect, useState } from 'react'

export type Orientation = 'portrait' | 'landscape'

function isMobileOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /android|iPad|iPhone|iPod/.test(ua)
}

export function useMobile(): { isMobile: boolean; orientation: Orientation } {
  const [mobile, setMobile] = useState(isMobileOS())
  const [orientation, setOrientation] = useState<Orientation>('portrait')

  useEffect(() => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    function check() {
      const w = window.innerWidth
      const h = window.innerHeight
      setMobile(isMobileOS() || w < 768 || (w < 1024 && isTouchDevice))
      setOrientation(w > h ? 'landscape' : 'portrait')
    }
    check()
    window.addEventListener('resize', check)
    const onOrientationChange = () => setTimeout(check, 200)
    window.addEventListener('orientationchange', onOrientationChange)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', onOrientationChange)
    }
  }, [])

  return { isMobile: mobile, orientation }
}
