import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell,
  AreaChart, Area,
} from 'recharts'
import { useSettingsStore } from '../../stores/settings-store'
import { useRatingServicesStore } from '../../stores/rating-services-store'
import { searchFiles, fetchFileMetadataByIds } from '../../api/search'
import { SERVICE_TYPE } from '../../api/types'
import { getViewCount } from '../../api/types'

interface EloPoint {
  elo: number
  count: number
}

interface CorrelationPoint {
  elo: number
  views: number
}

interface ViewBucket {
  label: string
  minViews: number
  avgElo: number
  count: number
}



export function EloGraph() {
  const [data, setData] = useState<EloPoint[]>([])
  const [correlationData, setCorrelationData] = useState<ViewBucket[]>([])
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState<'cache' | 'leaderboard'>('cache')
  const [viewState, setViewState] = useState<'distribution' | 'correlation'>('distribution')
  const [fileCount, setFileCount] = useState(0)
  const [logScale, setLogScale] = useState(false)
  const [chartMode, setChartMode] = useState<'bar' | 'curve'>('bar')
  const [binSize, setBinSize] = useState(1)
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
        const binned = binSize > 1 ? Math.floor(elo / binSize) * binSize : elo
        dist.set(binned, (dist.get(binned) || 0) + 1)
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
      const rawCorr: CorrelationPoint[] = []

      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500)
        const meta = await fetchFileMetadataByIds(chunk)
        for (const f of meta) {
          if (f.ratings) {
            const elo = f.ratings[incDecKey]
            if (typeof elo === 'number') {
              const binned = binSize > 1 ? Math.floor(elo / binSize) * binSize : elo
              dist.set(binned, (dist.get(binned) || 0) + 1)
              rawCorr.push({ elo, views: getViewCount(f) })
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

      const maxViews = rawCorr.reduce((m, p) => Math.max(m, p.views), 0)
      const bucketStep = 10
      const bucketCount = Math.ceil((maxViews + 1) / bucketStep)
      const buckets = Array.from({ length: bucketCount }, (_, i) => {
        const lo = i * bucketStep
        const hi = i * bucketStep + bucketStep - 1
        const label = lo === 0 ? '0' : hi > maxViews ? `${lo}+` : `${lo}-${hi}`
        return { label, min: lo, max: hi, eloSum: 0, count: 0 }
      })
      for (const p of rawCorr) {
        const idx = Math.min(buckets.length - 1, Math.floor(p.views / bucketStep))
        const b = buckets[idx]
        b.eloSum += p.elo; b.count++
      }
      setCorrelationData(
        buckets
          .filter((b) => b.count > 0)
          .map((b) => ({ label: b.label, minViews: b.min, avgElo: Math.round(b.eloSum / b.count), count: b.count }))
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

  useEffect(() => {
    if (source === 'leaderboard') loadFromLeaderboard()
    else loadFromCache()
  }, [binSize])

  const maxCount = Math.max(1, ...data.map((d) => d.count))
  const chartHeight = Math.max(300, Math.min(600, data.length * 20 + 100))

  function renderChart() {
    if (viewState === 'correlation') {
      if (correlationData.length === 0) {
        return (
          <div className="text-gray-400 text-sm text-center py-16">
            {source === 'cache' ? 'Click Leaderboard to load correlation data.' : 'No correlation data loaded.'}
          </div>
        )
      }
      return (
        <div className="w-full" style={{ height: 450 }}>
          <ResponsiveContainer width="100%" height={450}>
            <BarChart data={correlationData} margin={{ top: 10, right: 20, left: 0, bottom: 50 }}>
              <CartesianGrid strokeDasharray="2 5" stroke={darkMode ? '#374151' : '#d1d5db'} strokeWidth={0.5} />
              <XAxis dataKey="label" stroke={darkMode ? '#6b7280' : '#9ca3af'} tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 10 }} angle={-30} textAnchor="end" height={60} label={{ value: 'Total Views', position: 'insideBottom', offset: -30, fontSize: 12, fill: darkMode ? '#9ca3af' : '#6b7280' }} />
              <YAxis stroke={darkMode ? '#6b7280' : '#9ca3af'} tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }} label={{ value: 'Avg ELO Rating', angle: -90, position: 'insideLeft', offset: 10, fontSize: 12, fill: darkMode ? '#9ca3af' : '#6b7280' }} />
              <Tooltip contentStyle={{ fontSize: 12, backgroundColor: darkMode ? '#1f2937' : '#fff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? '#e5e7eb' : '#111827' }} formatter={(value: number, name: string) => {
                if (name === 'avgElo') return [value, 'Avg ELO']
                return [value, 'Files']
              }} labelFormatter={(label: string) => `Views: ${label}`} />
              <Bar dataKey="avgElo" radius={[2, 2, 0, 0]} fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
          <div className="text-xs text-gray-500 text-center mt-1">
            {correlationData.reduce((s, b) => s + b.count, 0)} files bucketed into {correlationData.length} view ranges
          </div>
        </div>
      )
    }

    if (data.length === 0) {
      return (
        <div className="text-gray-400 text-sm text-center py-16">
          No ELO ratings found. {source === 'cache' ? 'Build ratings cache in Settings or search from Leaderboard.' : ''}
        </div>
      )
    }

    return (
      <div className="w-full" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          {chartMode === 'bar' ? (
            <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="2 5" stroke={darkMode ? '#374151' : '#d1d5db'} strokeWidth={0.5} />
              <XAxis dataKey="elo" stroke={darkMode ? '#6b7280' : '#9ca3af'} tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }} tickFormatter={(v: number) => binSize > 1 ? `${v}-${v + binSize - 1}` : String(v)} label={{ value: 'ELO Rating', position: 'insideBottom', offset: -10, fontSize: 12, fill: darkMode ? '#9ca3af' : '#6b7280' }} />
              <YAxis scale={logScale ? 'log' : 'auto'} domain={logScale ? [1, 'auto'] : [0, 'auto']} stroke={darkMode ? '#6b7280' : '#9ca3af'} tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }} label={{ value: 'Submissions', angle: -90, position: 'insideLeft', offset: 10, fontSize: 12, fill: darkMode ? '#9ca3af' : '#6b7280' }} />
              <Tooltip contentStyle={{ fontSize: 12, backgroundColor: darkMode ? '#1f2937' : '#fff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? '#e5e7eb' : '#111827' }} formatter={(value: number) => [value, 'Submissions']} labelFormatter={(label: number) => `ELO: ${label}`} />
              <Bar dataKey="count" radius={[2, 2, 0, 0]} maxBarSize={binSize > 1 ? 80 : 40}>
                {data.map((entry, i) => {
                  const intensity = Math.min(1, entry.count / maxCount)
                  const r = Math.round(59 + (37 - 59) * intensity)
                  const g = Math.round(130 + (99 - 130) * intensity)
                  const b = Math.round(246 + (235 - 246) * intensity)
                  return <Cell key={i} fill={`rgb(${r},${g},${b})`} />
                })}
              </Bar>
            </BarChart>
          ) : (
            <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="2 5" stroke={darkMode ? '#374151' : '#d1d5db'} strokeWidth={0.5} />
              <XAxis dataKey="elo" stroke={darkMode ? '#6b7280' : '#9ca3af'} tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }} tickFormatter={(v: number) => binSize > 1 ? `${v}-${v + binSize - 1}` : String(v)} label={{ value: 'ELO Rating', position: 'insideBottom', offset: -10, fontSize: 12, fill: darkMode ? '#9ca3af' : '#6b7280' }} />
              <YAxis scale={logScale ? 'log' : 'auto'} domain={logScale ? [1, 'auto'] : [0, 'auto']} stroke={darkMode ? '#6b7280' : '#9ca3af'} tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }} label={{ value: 'Submissions', angle: -90, position: 'insideLeft', offset: 10, fontSize: 12, fill: darkMode ? '#9ca3af' : '#6b7280' }} />
              <Tooltip contentStyle={{ fontSize: 12, backgroundColor: darkMode ? '#1f2937' : '#fff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? '#e5e7eb' : '#111827' }} formatter={(value: number) => [value, 'Submissions']} labelFormatter={(label: number) => `ELO: ${label}`} />
              <defs>
                <linearGradient id="eloCurveFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#eloCurveFill)" dot={false} activeDot={{ r: 4, fill: '#3b82f6' }} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{viewState === 'correlation' ? 'Views vs ELO' : 'ELO Distribution'}</h2>
        <span className="text-xs text-gray-500">
          {viewState === 'correlation' ? `${correlationData.length} files` : `${fileCount} files`}
          {source === 'cache' ? ' (cached)' : ''}
        </span>
      </div>

      <div className="flex gap-1 items-center flex-wrap">
        <button
          className={`min-h-[36px] text-xs px-1.5 py-1 rounded ${source === 'cache' ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600'}`}
          onClick={loadFromCache}
        >
          Cache
        </button>
        <button
          className={`min-h-[36px] text-xs px-1.5 py-1 rounded ${source === 'leaderboard' ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600'}`}
          onClick={loadFromLeaderboard}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Leaderboard'}
        </button>
        <span className="text-xs text-gray-400 mx-1">|</span>
        <button
          className={`min-h-[36px] text-xs px-1.5 py-1 rounded ${viewState === 'distribution' ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600'}`}
          onClick={() => { setViewState('distribution'); if (source === 'cache') loadFromCache() }}
        >
          Distribution
        </button>
        <button
          className={`min-h-[36px] text-xs px-1.5 py-1 rounded ${viewState === 'correlation' ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600'}`}
          onClick={() => { setViewState('correlation'); if (source === 'leaderboard' && correlationData.length === 0) loadFromLeaderboard() }}
        >
          Views vs ELO
        </button>
        {viewState === 'distribution' && (
          <>
            <span className="text-xs text-gray-400 mx-1">Y:</span>
            <button
              className={`min-h-[36px] text-xs px-1.5 py-1 rounded ${!logScale ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600'}`}
              onClick={() => setLogScale(false)}
            >
              Lin
            </button>
            <button
              className={`min-h-[36px] text-xs px-1.5 py-1 rounded ${logScale ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600'}`}
              onClick={() => setLogScale(true)}
            >
              Log
            </button>
            <span className="text-xs text-gray-400 mx-1">V:</span>
            <button
              className={`min-h-[36px] text-xs px-1.5 py-1 rounded ${chartMode === 'bar' ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600'}`}
              onClick={() => setChartMode('bar')}
            >
              Bars
            </button>
            <button
              className={`min-h-[36px] text-xs px-1.5 py-1 rounded ${chartMode === 'curve' ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600'}`}
              onClick={() => setChartMode('curve')}
            >
              Curve
            </button>
            <span className="text-xs text-gray-400 mx-1">B:</span>
            {[1, 5, 10].map((b) => (
              <button key={b}
                className={`min-h-[36px] text-xs px-1.5 py-1 rounded ${binSize === b ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600'}`}
                onClick={() => setBinSize(b)}
              >
                {b}
              </button>
            ))}
          </>
        )}
      </div>

      {loading && (
        <div className="text-gray-400 text-sm text-center py-16">Loading...</div>
      )}

      {!loading && renderChart()}
    </div>
  )
}
