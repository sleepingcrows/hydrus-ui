import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell,
} from 'recharts'
import { useSettingsStore } from '../../stores/settings-store'
import { useRatingServicesStore } from '../../stores/rating-services-store'
import { searchFiles, fetchFileMetadataByIds } from '../../api/search'
import { SERVICE_TYPE } from '../../api/types'

interface EloPoint {
  elo: number
  count: number
}

export function EloGraph() {
  const [data, setData] = useState<EloPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState<'cache' | 'leaderboard'>('cache')
  const [fileCount, setFileCount] = useState(0)
  const [logScale, setLogScale] = useState(false)
  const darkMode = useSettingsStore((s) => s.darkMode)

  const incDecKey = useRatingServicesStore((s) =>
    s.services.find((sv) => sv.type === SERVICE_TYPE.INC_DEC_RATING)?.service_key
  )

  function computeDistribution(
    ratingsMap: Map<number, Record<string, number | boolean>>
  ): EloPoint[] {
    if (!incDecKey) return []
    const dist = new Map<number, number>()
    let total = 0
    for (const [, ratings] of ratingsMap) {
      const elo = ratings[incDecKey]
      if (typeof elo === 'number') {
        dist.set(elo, (dist.get(elo) || 0) + 1)
        total++
      }
    }
    setFileCount(total)
    return Array.from(dist.entries())
      .map(([elo, count]) => ({ elo, count }))
      .sort((a, b) => a.elo - b.elo)
  }

  function loadFromCache() {
    const cache = useSettingsStore.getState().getRatingsCache()
    if (!cache) {
      setData([])
      setFileCount(0)
      return
    }
    setSource('cache')
    setData(computeDistribution(cache))
  }

  async function loadFromLeaderboard() {
    if (!incDecKey) return
    setLoading(true)
    setSource('leaderboard')
    try {
      const result = await searchFiles({
        tags: ['system:has count for skill'],
        file_limit: 10000,
        return_hashes: false,
      })
      const ids = result.file_ids || []
      const dist = new Map<number, number>()

      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500)
        const meta = await fetchFileMetadataByIds(chunk)
        for (const f of meta) {
          if (f.ratings) {
            const elo = f.ratings[incDecKey]
            if (typeof elo === 'number') {
              dist.set(elo, (dist.get(elo) || 0) + 1)
            }
          }
        }
      }

      setFileCount(ids.length)
      setData(
        Array.from(dist.entries())
          .map(([elo, count]) => ({ elo, count }))
          .sort((a, b) => a.elo - b.elo)
      )
    } catch (e) {
      console.error('Failed to load ELO distribution:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFromCache()
  }, [incDecKey])

  const maxCount = Math.max(1, ...data.map((d) => d.count))
  const chartHeight = Math.max(300, Math.min(600, data.length * 20 + 100))

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">ELO Distribution</h2>
        <span className="text-xs text-gray-500">
          {fileCount} files
          {source === 'cache' ? ' (cached)' : ''}
        </span>
      </div>

      <div className="flex gap-2 items-center">
        <button
          className={`min-h-[44px] text-xs px-2 py-1 rounded ${source === 'cache' ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600'}`}
          onClick={loadFromCache}
        >
          From Cache
        </button>
        <button
          className={`min-h-[44px] text-xs px-2 py-1 rounded ${source === 'leaderboard' ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600'}`}
          onClick={loadFromLeaderboard}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'From Leaderboard'}
        </button>
        <span className="text-xs text-gray-400 ml-auto">Y-axis:</span>
        <button
          className={`min-h-[44px] text-xs px-2 py-1 rounded ${!logScale ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600'}`}
          onClick={() => setLogScale(false)}
        >
          Linear
        </button>
        <button
          className={`min-h-[44px] text-xs px-2 py-1 rounded ${logScale ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600'}`}
          onClick={() => setLogScale(true)}
        >
          Log
        </button>
      </div>

      {data.length === 0 && !loading && (
        <div className="text-gray-400 text-sm text-center py-16">
          No ELO ratings found. {source === 'cache' ? 'Build ratings cache in Settings or search from Leaderboard.' : ''}
        </div>
      )}

      {loading && (
        <div className="text-gray-400 text-sm text-center py-16">Loading...</div>
      )}

      {data.length > 0 && !loading && (
        <div className="w-full" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="2 5" stroke={darkMode ? '#374151' : '#d1d5db'} strokeWidth={0.5} />
              <XAxis
                dataKey="elo"
                stroke={darkMode ? '#6b7280' : '#9ca3af'}
                tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }}
                label={{ value: 'ELO Rating', position: 'insideBottom', offset: -10, fontSize: 12, fill: darkMode ? '#9ca3af' : '#6b7280' }}
              />
              <YAxis
                scale={logScale ? 'log' : 'auto'}
                domain={logScale ? [1, 'auto'] : [0, 'auto']}
                stroke={darkMode ? '#6b7280' : '#9ca3af'}
                tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }}
                label={{ value: 'Submissions', angle: -90, position: 'insideLeft', offset: 10, fontSize: 12, fill: darkMode ? '#9ca3af' : '#6b7280' }}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, backgroundColor: darkMode ? '#1f2937' : '#fff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? '#e5e7eb' : '#111827' }}
                formatter={(value: number, _name: string) => [value, 'Submissions']}
                labelFormatter={(label: number) => `ELO: ${label}`}
              />
              <Bar dataKey="count" radius={[2, 2, 0, 0]} maxBarSize={40}>
                {data.map((entry, i) => {
                  const intensity = Math.min(1, entry.count / maxCount)
                  const r = Math.round(59 + (37 - 59) * intensity)
                  const g = Math.round(130 + (99 - 130) * intensity)
                  const b = Math.round(246 + (235 - 246) * intensity)
                  return <Cell key={i} fill={`rgb(${r},${g},${b})`} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
