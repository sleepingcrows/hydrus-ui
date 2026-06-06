import { useState, useCallback } from 'react'
import { getThumbnailUrl } from '../api/search'

export function useThumbnail(hash: string | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!hash) return
    setLoading(true)
    try {
      const u = await getThumbnailUrl(hash)
      setUrl(u)
    } catch {
      setUrl(null)
    } finally {
      setLoading(false)
    }
  }, [hash])

  return { url, loading, load }
}
