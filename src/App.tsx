import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useApiStore } from './stores/api-store'
import { useSettingsStore } from './stores/settings-store'
import { useRatingServicesStore } from './stores/rating-services-store'
import { ConnectionSettings } from './features/settings/ConnectionSettings'
import { SearchPage } from './features/search/SearchPage'
import { SmashOrPass } from './features/smash-or-pass/SmashOrPass'
import { TagAnalyticsPanel } from './features/smash-or-pass/TagAnalyticsPanel'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

type Tab = 'search' | 'smash-pass' | 'analytics' | 'leaderboard' | 'favorites' | 'settings'

export default function App() {
  const { connected, hydrate } = useApiStore()
  const settingsHydrate = useSettingsStore((s) => s.hydrate)
  const ratingServicesHydrate = useRatingServicesStore((s) => s.load)
  const [tab, setTab] = useState<Tab>('search')

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
        <header className="flex items-center gap-1 px-2 py-1 border-b dark:border-gray-700 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`px-3 py-1 text-sm rounded ${
                tab === t.id
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
          <button
            className="ml-auto text-xs text-gray-400 hover:text-red-500"
            onClick={() => useApiStore.getState().disconnect()}
          >
            Disconnect
          </button>
        </header>
        <main className="flex-1 overflow-hidden">
          {tab === 'search' && <SearchPage key="search" />}
          {tab === 'smash-pass' && <SmashOrPass />}
          {tab === 'leaderboard' && <SearchPage key="leaderboard" presetTags={['system:has count for skill']} title="Leaderboard" sortByRating displayLimit={500} />}
          {tab === 'favorites' && <SearchPage key="favorites" presetTags={['system:rating for Like-Dislike is like']} title="Favorites" />}
          {tab === 'analytics' && <TagAnalyticsPanel />}
          {tab === 'settings' && <ConnectionSettings />}
        </main>
      </div>
    </QueryClientProvider>
  )
}
