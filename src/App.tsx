import { useEffect, useRef, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useApiStore } from './stores/api-store'
import { useSettingsStore } from './stores/settings-store'
import { useRatingServicesStore } from './stores/rating-services-store'
import { SERVICE_TYPE } from './api/types'
import { useMobile } from './hooks/use-mobile'
import { ConnectionSettings } from './features/settings/ConnectionSettings'
import { SearchPage } from './features/search/SearchPage'
import { HomePage } from './features/home/HomePage'
import { SmashOrPass } from './features/smash-or-pass/SmashOrPass'
import { TagAnalyticsPanel } from './features/smash-or-pass/TagAnalyticsPanel'
import { EloGraph } from './features/smash-or-pass/EloGraph'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

type Tab = 'search' | 'smash-pass' | 'analytics' | 'leaderboard' | 'favorites' | 'settings' | 'home'

export default function App() {
  const { connected, hydrate } = useApiStore()
  const settingsHydrate = useSettingsStore((s) => s.hydrate)
  const ratingServicesHydrate = useRatingServicesStore((s) => s.load)
  const [tab, setTab] = useState<Tab>('search')
  const [analyticsView, setAnalyticsView] = useState<'tag-preferences' | 'elo-graph'>('tag-preferences')
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const analyticsTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const [favTags, setFavTags] = useState<string[]>([])
  const { isMobile } = useMobile()
  const [searchOpen, setSearchOpen] = useState(false)
  const [smashSearchOpen, setSmashSearchOpen] = useState(false)
  const [bookmarkSearch, setBookmarkSearch] = useState<{ tags: string[]; sortType: number; sortAsc: boolean; key: number } | null>(null)

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
    { id: 'home', label: 'Home' },
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
          {isMobile ? (
            <>
              <button
                className="min-h-[44px] min-w-[44px] p-2 text-lg leading-none text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 active:text-gray-700"
                onClick={() => setMenuOpen(true)}
                aria-label="Menu"
              >
                ☰
              </button>
              {tab === 'search' && (
                <button
                  className="min-h-[44px] min-w-[44px] p-2 rounded text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600 transition-colors"
                  onClick={() => setSearchOpen((v) => !v)}
                  aria-label={searchOpen ? 'Collapse search' : 'Expand search'}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                </button>
              )}
              {tab === 'smash-pass' && (
                <button
                  className="min-h-[44px] min-w-[44px] p-2 rounded text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600 transition-colors"
                  onClick={() => setSmashSearchOpen((v) => !v)}
                  aria-label={smashSearchOpen ? 'Collapse tag filter' : 'Expand tag filter'}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
                  </svg>
                </button>
              )}
              <span className="flex-1 text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">
                {tab === 'analytics'
                  ? `Analytics – ${analyticsView === 'tag-preferences' ? 'Tag Preferences' : 'ELO Distribution'}`
                  : tabs.find((t) => t.id === tab)?.label ?? 'hydrus-ui'}
              </span>
              {menuOpen && (
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
              )}
              <div
                className={`fixed left-0 top-0 bottom-0 w-64 z-50 bg-white dark:bg-gray-900 border-r dark:border-gray-700 shadow-xl transform transition-transform duration-200 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">hydrus-ui</span>
                  <button
                    className="min-h-[44px] min-w-[44px] p-2 text-lg leading-none text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 active:text-gray-900"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Close menu"
                  >
                    ✕
                  </button>
                </div>
                <nav className="p-2 space-y-1">
                  {tabs.map((t) =>
                    t.id === 'analytics' ? (
                      <div key="analytics" className="space-y-0.5">
                        <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Analytics</div>
                        <button
                          className={`w-full text-left min-h-[44px] px-3 py-2 text-sm rounded ${
                            tab === 'analytics' && analyticsView === 'tag-preferences'
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-medium'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700'
                          }`}
                          onClick={() => { setTab('analytics'); setAnalyticsView('tag-preferences'); setMenuOpen(false) }}
                        >
                          Tag Preferences
                        </button>
                        <button
                          className={`w-full text-left min-h-[44px] px-3 py-2 text-sm rounded ${
                            tab === 'analytics' && analyticsView === 'elo-graph'
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-medium'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700'
                          }`}
                          onClick={() => { setTab('analytics'); setAnalyticsView('elo-graph'); setMenuOpen(false) }}
                        >
                          ELO Distribution
                        </button>
                      </div>
                    ) : (
                      <button
                        key={t.id}
                        className={`w-full text-left min-h-[44px] px-3 py-2 text-sm rounded ${
                          tab === t.id
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-medium'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700'
                        }`}
                        onClick={() => { setTab(t.id); setMenuOpen(false) }}
                      >
                        {t.label}
                      </button>
                    )
                  )}
                </nav>
              </div>
            </>
          ) : (
            <>
              {tabs.map((t) =>
                t.id === 'analytics' ? (
                  <div
                    key="analytics"
                    className="relative flex-shrink-0"
                    onMouseEnter={() => { clearTimeout(analyticsTimeoutRef.current); setAnalyticsOpen(true) }}
                    onMouseLeave={() => { analyticsTimeoutRef.current = setTimeout(() => setAnalyticsOpen(false), 200) }}
                  >
                    <button
                      className={`min-h-[44px] px-3 py-1 text-sm rounded whitespace-nowrap ${
                        tab === 'analytics'
                          ? 'bg-blue-600 text-white'
                          : 'hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600'
                      }`}
                      onClick={() => setTab('analytics')}
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
            </>
          )}
        </header>
        <main className="flex-1 overflow-hidden">
          {tab === 'search' && (bookmarkSearch ? <SearchPage key={'bookmark-' + bookmarkSearch.key} initialTags={bookmarkSearch.tags} initialSortType={bookmarkSearch.sortType} initialSortAsc={bookmarkSearch.sortAsc} /> : <SearchPage key="search" searchOpen={searchOpen} onSearchToggle={() => setSearchOpen((v) => !v)} />)}
          {tab === 'smash-pass' && <SmashOrPass smashSearchOpen={smashSearchOpen} onSmashSearchToggle={() => setSmashSearchOpen((v) => !v)} />}
          {tab === 'leaderboard' && <SearchPage key="leaderboard" presetTags={['system:has count for skill']} title="Leaderboard" sortByRating displayLimit={500} />}
          {tab === 'favorites' && <SearchPage key="favorites" presetTags={favTags} title="Favorites" />}
          {tab === 'analytics' && analyticsView === 'tag-preferences' && <TagAnalyticsPanel />}
          {tab === 'analytics' && analyticsView === 'elo-graph' && <EloGraph />}
          {tab === 'home' && <HomePage onSearchBookmark={(tags, sortType, sortAsc) => { setBookmarkSearch({ tags, sortType, sortAsc, key: Date.now() }); setTab('search') }} />}
          {tab === 'settings' && <ConnectionSettings />}
        </main>
      </div>
    </QueryClientProvider>
  )
}
