import { useState, useEffect, useRef } from 'react'
import { searchTags } from '../api/tags'

export function useTagSearch(query: string) {
  const [results, setResults] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const searchIdRef = useRef(0)

  useEffect(() => {
    if (!query || query.length < 1) {
      setResults([])
      return
    }
    setLoading(true)
    clearTimeout(timer.current)
    const id = ++searchIdRef.current
    timer.current = setTimeout(async () => {
      try {
        const tags = await searchTags(query)
        if (id !== searchIdRef.current) return
        setResults(tags)
      } catch {
        if (id === searchIdRef.current) setResults([])
      } finally {
        if (id === searchIdRef.current) setLoading(false)
      }
    }, 200)
    return () => clearTimeout(timer.current)
  }, [query])

  return { results, loading }
}
