import { useEffect, useState } from 'react'

export function useMobile(): boolean {
  const [mobile, setMobile] = useState(false)

  useEffect(() => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    function check() {
      setMobile(window.innerWidth < 768 || (window.innerWidth < 1024 && isTouchDevice))
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return mobile
}
