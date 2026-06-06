import { useEffect, useState } from 'react'
import { getTagStats, clearTagHistory, getTotalRatedCount, getTagPreferences } from './tag-history'
import type { TagStats, TagPreference } from '../../api/types'
import { getNamespaceColorName } from '../../utils/namespace-colors'
import type { TagColor } from '../../utils/namespace-colors'

const TAG_TEXT_COLORS: Record<TagColor, string> = {
  gray:   'text-gray-500 dark:text-gray-400',
  blue:   'text-blue-600 dark:text-blue-300',
  green:  'text-green-600 dark:text-green-300',
  purple: 'text-purple-600 dark:text-purple-300',
  amber:  'text-amber-600 dark:text-amber-300',
  pink:   'text-pink-600 dark:text-pink-300',
  indigo: 'text-indigo-600 dark:text-indigo-300',
  teal:   'text-teal-600 dark:text-teal-300',
  red:    'text-red-600 dark:text-red-300',
  orange: 'text-orange-600 dark:text-orange-300',
}

export function TagAnalyticsPanel() {
  const [tagStats, setTagStats] = useState<TagStats[]>([])
  const [tagPrefs, setTagPrefs] = useState<TagPreference[]>([])
  const [totalRated, setTotalRated] = useState(0)
  const [minAppearances, setMinAppearances] = useState(3)
  const [sortBy, setSortBy] = useState<'ratio' | 'count' | 'rating' | 'weight'>('weight')
  const [mode, setMode] = useState<'stats' | 'prefs'>('prefs')

  useEffect(() => {
    loadStats()
  }, [minAppearances])

  async function loadStats() {
    const [stats, total, prefs] = await Promise.all([
      getTagStats(minAppearances),
      getTotalRatedCount(),
      getTagPreferences(),
    ])
    setTagStats(stats)
    setTagPrefs(prefs)
    setTotalRated(total)
  }

  const sortedStats = [...tagStats].sort((a, b) => {
    if (sortBy === 'count') return b.count - a.count
    if (sortBy === 'rating') return b.current_rating - a.current_rating
    return b.ratio - a.ratio
  })

  const sortedPrefs = [...tagPrefs]
    .filter((t) => t.appearances >= minAppearances)
    .sort((a, b) => {
      if (sortBy === 'count') return b.appearances - a.appearances
      if (sortBy === 'weight') return b.weight - a.weight
      return b.avg_mu_change - a.avg_mu_change
    })

  const displayTags = mode === 'prefs' ? sortedPrefs.slice(0, 50) : sortedStats.slice(0, 30)
  const maxAbsWeight = mode === 'prefs'
    ? Math.max(1, Math.max(...sortedPrefs.map((t) => Math.abs(t.weight))))
    : 1

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Tag Preferences</h2>
        <span className="text-xs text-gray-500">{totalRated} total ratings</span>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <span className="text-xs text-gray-500">Sort:</span>
        <select
          className="text-xs border rounded px-2 py-1"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
        >
          {mode === 'prefs' ? (
            <>
              <option value="weight">Alignment (mu)</option>
              <option value="count">Most Rated</option>
              <option value="rating">Avg Mu Change</option>
            </>
          ) : (
            <>
              <option value="ratio">Smash Ratio</option>
              <option value="count">Most Rated</option>
              <option value="rating">TrueSkill Rating</option>
            </>
          )}
        </select>
        <span className="text-xs text-gray-500 ml-2">Min appearances:</span>
        <input
          type="number"
          className="text-xs border rounded px-2 py-1 w-16"
          value={minAppearances}
          onChange={(e) => setMinAppearances(Math.max(1, Number(e.target.value)))}
          min={1}
        />
        <button
          className={`text-xs px-2 py-1 rounded ${mode === 'prefs' ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
          onClick={() => setMode('prefs')}
        >
          Alignment
        </button>
        <button
          className={`text-xs px-2 py-1 rounded ${mode === 'stats' ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
          onClick={() => setMode('stats')}
        >
          Ratio
        </button>
        <button className="text-xs text-red-500 ml-auto" onClick={async () => {
          await clearTagHistory()
          loadStats()
        }}>
          Clear history
        </button>
      </div>

      <div className="space-y-1">
        {displayTags.length === 0 && (
          <div className="text-gray-400 text-sm text-center py-8">
            Rate some files in Smash/Pass to see tag analytics.
          </div>
        )}
        {mode === 'prefs' && (displayTags as TagPreference[]).map((t) => {
          const pct = Math.abs(t.weight) / maxAbsWeight
          const barWidth = Math.min(100, pct * 100)
          const isPositive = t.weight >= 0
          return (
            <div key={t.tag} className="flex items-center gap-2 text-xs">
              <span className={`w-48 truncate text-right ${TAG_TEXT_COLORS[getNamespaceColorName(t.tag)]}`} title={t.tag}>{t.tag}</span>
              <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded relative overflow-hidden">
                <div
                  className={`h-full rounded transition-all ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className="w-20 text-right font-mono" title={`\u03bc: ${t.weight.toFixed(1)}`}>
                {t.weight > 0 ? '+' : ''}{t.weight.toFixed(1)}
              </span>
              <span className="w-12 text-right text-gray-400">{t.appearances}x</span>
            </div>
          )
        })}
        {mode === 'stats' && (displayTags as TagStats[]).map((t) => {
          const ratingLabel = t.current_rating.toFixed(1)
          return (
            <div key={t.tag} className="flex items-center gap-2 text-xs">
              <span className={`w-48 truncate text-right ${TAG_TEXT_COLORS[getNamespaceColorName(t.tag)]}`} title={t.tag}>{t.tag}</span>
              <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded relative overflow-hidden">
                <div
                  className={`h-full rounded transition-all ${
                    t.ratio >= 0.6 ? 'bg-green-500' : t.ratio >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${t.ratio * 100}%` }}
                />
                <span className="absolute inset-0 flex items-center px-1 text-[10px] text-white mix-blend-difference">
                  {t.smash_count}/{t.count} ({Math.round(t.ratio * 100)}%)
                </span>
              </div>
              <span className="w-16 text-right font-mono" title={`\u03bc=${t.current_mu.toFixed(1)} \u03c3=${t.current_sigma.toFixed(2)}`}>
                {ratingLabel}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
