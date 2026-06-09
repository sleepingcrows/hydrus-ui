import { useEffect, useRef, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useApiStore } from './stores/api-store'
import { useSettingsStore } from './stores/settings-store'
import { useRatingServicesStore } from './stores/rating-services-store'
import { SERVICE_TYPE } from './api/types'
import { useMobile } from './hooks/use-mobile'
import { ConnectionSettings } from './features/settings/ConnectionSettings'
import { SearchPage } from './features/search/SearchPage'
import { SmashOrPass } from './features/smash-or-pass/SmashOrPass'
import { TagAnalyticsPanel } from './features/smash-or-pass/TagAnalyticsPanel'
import { EloGraph } from './features/smash-or-pass/EloGraph'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

type Tab = 'search' | 'smash-pass' | 'analytics' | 'leaderboard' | 'favorites' | 'settings'

export default function App() {
  const { connected, hydrate } = useApiStore()
  const settingsHydrate = useSettingsStore((s) => s.hydrate)
  const ratingServicesHydrate = useRatingServicesStore((s) => s.load)
  const [tab, setTab] = useState<Tab>('search')
  const [analyticsView, setAnalyticsView] = useState<'tag-preferences' | 'elo-graph'>('tag-preferences')
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const analyticsTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const [favTags, setFavTags] = useState<string[]>([])
  const isMobile = useMobile()

  const configuredLikeKey = useSettingsStore((s) => s.likeServiceKey)
  const allServices = useRatingServicesStore((s) => s.services)

  useEffect(() => {
    if (!configuredLikeKey) {
      const autoService = allServices.find((s) => s.type === SERVICE_TYPE.LIKE_DISLIKE_RATING)
      if (autoService) {
        setFavTags([`system:rating for ${autoService.name} is like`])
      } else {
        setFavTags(['system:rating for "Like-Dislike" is like'])
      }
    } else {
      const svc = allServices.find((s) => s.service_key === configuredLikeKey)
      if (svc) {
        setFavTags([`system:rating for ${svc.name} is like`])
      }
    }
  }, [configuredLikeKey, allServices])

  useEffect(() => {
    hydrate()
    settingsHydrate()
  }, [])

  useEffect(() => {
    if (connected) ratingServicesHydrate()
  }, [connected])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'search', label: 'Search' },
    { id: 'smash-pass', label: 'Smash/Pass' },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'favorites', label: 'Favorites' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'settings', label: 'Settings' },
  ]

  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <ConnectionSettings />
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <header className="flex items-center gap-1 px-2 py-1 overflow-x-auto border-b dark:border-gray-700 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          {tabs.map((t) =>
            t.id === 'analytics' ? (
              <div
                key="analytics"
                className="relative flex-shrink-0"
                onMouseEnter={() => { if (!isMobile) { clearTimeout(analyticsTimeoutRef.current); setAnalyticsOpen(true) }}}
                onMouseLeave={() => { if (!isMobile) { analyticsTimeoutRef.current = setTimeout(() => setAnalyticsOpen(false), 200) }}}
              >
                <button
                  className={`min-h-[44px] px-3 py-1 text-sm rounded whitespace-nowrap ${
                    tab === 'analytics'
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600'
                  }`}
                  onClick={() => { if (isMobile) { setAnalyticsOpen(!analyticsOpen) } else { setTab('analytics') }}}
                >
                  Analytics
                </button>
                {analyticsOpen && (
                  <div className="absolute top-full left-0 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-lg z-50 min-w-[160px] text-gray-900 dark:text-gray-100">
                    <button
                      className={`block w-full text-left min-h-[44px] px-3 py-1.5 text-sm whitespace-nowrap ${
                        analyticsView === 'tag-preferences' ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600'
                      }`}
                      onClick={() => { setTab('analytics'); setAnalyticsView('tag-preferences'); setAnalyticsOpen(false) }}
                    >
                      Tag Preferences
                    </button>
                    <button
                      className={`block w-full text-left min-h-[44px] px-3 py-1.5 text-sm whitespace-nowrap ${
                        analyticsView === 'elo-graph' ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600'
                      }`}
                      onClick={() => { setTab('analytics'); setAnalyticsView('elo-graph'); setAnalyticsOpen(false) }}
                    >
                      ELO Distribution
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                key={t.id}
                className={`min-h-[44px] px-3 py-1 text-sm rounded whitespace-nowrap flex-shrink-0 ${
                  tab === t.id
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600'
                }`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            )
          )}
          <button
            className="ml-auto min-h-[44px] min-w-[44px] p-2 text-xs text-gray-400 hover:text-red-500 active:text-red-600 flex-shrink-0"
            onClick={() => useApiStore.getState().disconnect()}
          >
            Disconnect
          </button>
        </header>
        <main className="flex-1 overflow-hidden">
          {tab === 'search' && <SearchPage key="search" />}
          {tab === 'smash-pass' && <SmashOrPass />}
          {tab === 'leaderboard' && <SearchPage key="leaderboard" presetTags={['system:has count for skill']} title="Leaderboard" sortByRating displayLimit={500} />}
          {tab === 'favorites' && <SearchPage key="favorites" presetTags={favTags} title="Favorites" />}
          {tab === 'analytics' && analyticsView === 'tag-preferences' && <TagAnalyticsPanel />}
          {tab === 'analytics' && analyticsView === 'elo-graph' && <EloGraph />}
          {tab === 'settings' && <ConnectionSettings />}
        </main>
      </div>
    </QueryClientProvider>
  )
}
