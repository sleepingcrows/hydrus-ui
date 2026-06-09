import { useEffect, useState } from 'react'

export type Orientation = 'portrait' | 'landscape'

export function useMobile(): { isMobile: boolean; orientation: Orientation } {
  const [mobile, setMobile] = useState(false)
  const [orientation, setOrientation] = useState<Orientation>('portrait')

  useEffect(() => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    function check() {
      const w = window.innerWidth
      const h = window.innerHeight
      setMobile(w < 768 || (w < 1024 && isTouchDevice))
      setOrientation(w > h ? 'landscape' : 'portrait')
    }
    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', () => setTimeout(check, 200))
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  return { isMobile: mobile, orientation }
}
