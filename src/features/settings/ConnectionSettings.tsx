import { useState, useRef } from 'react'
import { useApiStore } from '../../stores/api-store'
import { useRatingServicesStore } from '../../stores/rating-services-store'
import { useSettingsStore } from '../../stores/settings-store'
import { testConnection } from '../../api/client'
import { NamespaceColorsConfig } from './NamespaceColorsConfig'
import { GalleryLayoutSettings } from './GalleryLayoutSettings'
import { SERVICE_TYPE } from '../../api/types'
import { exportToQR, importFromQR } from '../../utils/qr-io'

export function ConnectionSettings() {
  const { url, key, connected, setApiKey, disconnect } = useApiStore()
  const urlRef = useRef<HTMLInputElement>(null)
  const keyRef = useRef<HTMLInputElement>(null)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadRatingServices = useRatingServicesStore((s) => s.load)

  async function handleConnect() {
    setTesting(true)
    setError(null)

    const actualUrl = (urlRef.current?.value || '').trim()
    const actualKey = (keyRef.current?.value || '').trim()

    if (!actualUrl) {
      setError('API URL required')
      setTesting(false)
      return
    }

    if (!actualKey) {
      setError('Access key required — check Hydrus Client review services or enter manually')
      setTesting(false)
      return
    }

    try {
      await testConnection(actualUrl, actualKey)
      setApiKey(actualUrl, actualKey)
      loadRatingServices()
    } catch (e) {
      setError(String(e))
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4 h-full overflow-y-auto text-gray-900 dark:text-gray-100">
      <h2 className="text-lg font-bold">Connection</h2>
      <div>
        <label className="text-sm text-gray-500 dark:text-gray-400">API URL</label>
        <input
          ref={urlRef}
          type="text"
          name="hydrusApiUrl"
          defaultValue={url || 'http://127.0.0.1:45869'}
          className="w-full border dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          placeholder="http://127.0.0.1:45869"
          autoComplete="off"
          autoCapitalize="off"
          inputMode="url"
        />
      </div>
      <div>
        <label className="text-sm text-gray-500 dark:text-gray-400">Access Key</label>
        <input
          ref={keyRef}
          type="password"
          name="hydrusApiKey"
          defaultValue={key}
          className="w-full border dark:border-gray-600 rounded px-2 py-1 text-sm font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          placeholder="64-character hex key"
          autoComplete="off"
          autoCapitalize="off"
        />
      </div>
      {error && <div className="text-red-500 text-sm">{error}</div>}
      {connected && <div className="text-green-600 text-sm">Connected</div>}
      <div className="flex gap-2 flex-wrap">
        {!connected ? (
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
            onClick={handleConnect}
            disabled={testing}
          >
            {testing ? 'Testing...' : 'Connect'}
          </button>
        ) : (
          <button
            className="px-4 py-2 bg-red-600 text-white rounded text-sm"
            onClick={disconnect}
          >
            Disconnect
          </button>
        )}
      </div>

      <hr className="border-gray-200 dark:border-gray-700" />

      <h3 className="text-sm font-bold">Smash/Pass</h3>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={useSettingsStore((s) => s.smashPassStaticMode)}
          onChange={() => useSettingsStore.getState().toggleSmashPassStatic()}
          className="rounded"
        />
        Static shuffle (same order every session)
      </label>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={useSettingsStore((s) => s.terminatedMode)}
          onChange={() => useSettingsStore.getState().toggleTerminatedMode()}
          className="rounded"
        />
        TERMINATED mode
      </label>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={useSettingsStore((s) => s.smashPassDualMode)}
          onChange={() => useSettingsStore.getState().toggleSmashPassDualMode()}
          className="rounded"
        />
        Dual queue mode (A vs B tag sets)
      </label>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={useSettingsStore((s) => s.smashPassSwipeVote)}
          onChange={() => useSettingsStore.getState().toggleSmashPassSwipeVote()}
          className="rounded"
        />
        Swipe voting (mobile: up=left, down=right, right=draw)
      </label>

      <details className="text-sm">
        <summary className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Rating formula</summary>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
          <label className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Base inc</span>
            <input type="number" min={0} max={999} inputMode="numeric"
              value={useSettingsStore((s) => s.ratingBaseInc)}
              onChange={(e) => useSettingsStore.getState().setRatingBaseInc(Number(e.target.value))}
              className="w-16 border dark:border-gray-600 rounded px-1 py-0.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-right" />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Loser dec</span>
            <input type="number" min={0} max={999} inputMode="numeric"
              value={useSettingsStore((s) => s.ratingLoserDec)}
              onChange={(e) => useSettingsStore.getState().setRatingLoserDec(Number(e.target.value))}
              className="w-16 border dark:border-gray-600 rounded px-1 py-0.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-right" />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Streak threshold</span>
            <input type="number" min={1} max={999} inputMode="numeric"
              value={useSettingsStore((s) => s.ratingStreakThreshold)}
              onChange={(e) => useSettingsStore.getState().setRatingStreakThreshold(Number(e.target.value))}
              className="w-16 border dark:border-gray-600 rounded px-1 py-0.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-right" />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Streak bonus</span>
            <input type="number" min={0} max={999} inputMode="numeric"
              value={useSettingsStore((s) => s.ratingStreakBonus)}
              onChange={(e) => useSettingsStore.getState().setRatingStreakBonus(Number(e.target.value))}
              className="w-16 border dark:border-gray-600 rounded px-1 py-0.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-right" />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Underdog threshold</span>
            <input type="number" min={0} max={9999} inputMode="numeric"
              value={useSettingsStore((s) => s.underdogThreshold)}
              onChange={(e) => useSettingsStore.getState().setUnderdogThreshold(Number(e.target.value))}
              className="w-16 border dark:border-gray-600 rounded px-1 py-0.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-right" />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Underdog min gap</span>
            <input type="number" min={0} max={9999} inputMode="numeric"
              value={useSettingsStore((s) => s.underdogMinGap)}
              onChange={(e) => useSettingsStore.getState().setUnderdogMinGap(Number(e.target.value))}
              className="w-16 border dark:border-gray-600 rounded px-1 py-0.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-right" />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Underdog boost %</span>
            <input type="number" min={0} max={100} inputMode="numeric"
              value={useSettingsStore((s) => s.underdogBoostPct)}
              onChange={(e) => useSettingsStore.getState().setUnderdogBoostPct(Number(e.target.value))}
              className="w-16 border dark:border-gray-600 rounded px-1 py-0.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-right" />
          </label>
        </div>
      </details>

      <div className="mt-3">
        <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1">Rating service for Smash/Pass ELO</label>
        <select
          className="w-full border dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
          value={useSettingsStore((s) => s.ratingServiceKey)}
          onChange={(e) => useSettingsStore.getState().setRatingServiceKey(e.target.value)}
        >
          <option value="">Auto-detect (first inc/dec)</option>
          {useRatingServicesStore((s) => s.services)
            .filter((svc) => svc.type === SERVICE_TYPE.INC_DEC_RATING)
            .map((svc) => (
              <option key={svc.service_key} value={svc.service_key}>
                {svc.name} - {svc.service_key}
              </option>
            ))}
        </select>
        {useRatingServicesStore((s) => s.services).length === 0 && (
          <span className="text-xs text-gray-400 mt-1 block">Connect to Hydrus to load services</span>
        )}
      </div>

      <div className="mt-3">
        <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1">Like/Dislike service for Gallery hearts</label>
        <select
          className="w-full border dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
          value={useSettingsStore((s) => s.likeServiceKey)}
          onChange={(e) => useSettingsStore.getState().setLikeServiceKey(e.target.value)}
        >
          <option value="">Auto-detect (first like/dislike)</option>
          {useRatingServicesStore((s) => s.services)
            .filter((svc) => svc.type === SERVICE_TYPE.LIKE_DISLIKE_RATING)
            .map((svc) => (
              <option key={svc.service_key} value={svc.service_key}>
                {svc.name} - {svc.service_key}
              </option>
            ))}
        </select>
      </div>

      {connected && (
        <div className="mt-4">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
            onClick={() => {
              const tags = useSettingsStore.getState().smashPassTags
              useSettingsStore.getState().rebuildRatingsCache(tags.length > 0 ? tags : ['system:everything'])
            }}
            disabled={useSettingsStore((s) => s.ratingsCacheBuildProgress !== null)}
          >
            {useSettingsStore((s) => {
              if (s.ratingsCacheBuildProgress !== null) return `Rebuilding cache... ${s.ratingsCacheBuildProgress}%`
              return 'Rebuild ratings cache'
            })}
          </button>
          <p className="text-xs text-gray-400 mt-1">
            Fetches ratings for the first 10,000 files matching your tags. Additional files are cached as you browse.
          </p>
        </div>
      )}

      <hr className="border-gray-200 dark:border-gray-700" />
      <GalleryLayoutSettings />

      <hr className="border-gray-200 dark:border-gray-700" />
      <h3 className="text-sm font-bold">Search</h3>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={useSettingsStore((s) => s.searchAutoSubmit)}
          onChange={() => useSettingsStore.getState().toggleSearchAutoSubmit()}
          className="rounded"
        />
        Auto-submit on tag select
      </label>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Selecting a tag from autocomplete or pressing Enter immediately submits search instead of requiring Search button.
      </p>

      <hr className="border-gray-200 dark:border-gray-700" />
      <NamespaceColorsConfig />

      <details className="text-sm">
        <summary className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Data Export / Import</summary>
        <div className="mt-2 space-y-2">
          <button
            className="px-3 py-1 min-h-[44px] bg-blue-600 text-white rounded text-sm disabled:opacity-50 hover:bg-blue-700 active:bg-blue-800"
            onClick={async () => {
              const s = useSettingsStore.getState()
              const blob = await exportToQR({
                version: 1,
                bookmarks: s.bookmarks.map((b) => ({ name: b.name, tags: b.tags, sortType: b.sortType, sortAsc: b.sortAsc, limit: b.limit })),
                searchHistory: s.searchHistory,
                settings: {
                  ratingServiceKey: s.ratingServiceKey, likeServiceKey: s.likeServiceKey,
                  ratingBaseInc: s.ratingBaseInc, ratingLoserDec: s.ratingLoserDec,
                  ratingStreakThreshold: s.ratingStreakThreshold, ratingStreakBonus: s.ratingStreakBonus,
                  underdogThreshold: s.underdogThreshold, underdogMinGap: s.underdogMinGap, underdogBoostPct: s.underdogBoostPct,
                  searchAutoSubmit: s.searchAutoSubmit,
                  smashPassStaticMode: s.smashPassStaticMode, smashPassTags: s.smashPassTags, smashPassTagsB: s.smashPassTagsB,
                  smashPassDualMode: s.smashPassDualMode, terminatedMode: s.terminatedMode, smashPassSwipeVote: s.smashPassSwipeVote,
                  galleryLayoutMode: s.galleryLayoutMode,
                  carouselFloatingPanel: s.carouselFloatingPanel, carouselNavSide: s.carouselNavSide,
                  smashFloatingPanel: s.smashFloatingPanel, smashNavSide: s.smashNavSide,
                },
              })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = 'hydrus-ui-backup.png'; a.click()
              URL.revokeObjectURL(url)
            }}
          >
            Export backup QR
          </button>
          <button
            className="px-3 py-1 min-h-[44px] bg-gray-600 text-white rounded text-sm disabled:opacity-50 hover:bg-gray-700 active:bg-gray-800"
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'; input.accept = 'image/png'
              input.onchange = async () => {
                const file = input.files?.[0]
                if (!file) return
                try {
                  const data = await importFromQR(file)
                  const s = useSettingsStore.getState()
                  const count = data.bookmarks.length + data.searchHistory.length
                  if (!confirm(`Import ${count} items? ${data.bookmarks.length} bookmarks, ${data.searchHistory.length} history entries. This will replace current data.`)) return
                  for (const b of data.bookmarks) s.addBookmark(b)
                  for (const h of data.searchHistory) s.addToSearchHistory(h)
                  const set = data.settings
                  if (set.ratingServiceKey !== undefined) s.setRatingServiceKey(set.ratingServiceKey)
                  if (set.likeServiceKey !== undefined) s.setLikeServiceKey(set.likeServiceKey)
                  if (set.ratingBaseInc !== undefined) s.setRatingBaseInc(set.ratingBaseInc)
                  if (set.ratingLoserDec !== undefined) s.setRatingLoserDec(set.ratingLoserDec)
                  if (set.ratingStreakThreshold !== undefined) s.setRatingStreakThreshold(set.ratingStreakThreshold)
                  if (set.ratingStreakBonus !== undefined) s.setRatingStreakBonus(set.ratingStreakBonus)
                  if (set.underdogThreshold !== undefined) s.setUnderdogThreshold(set.underdogThreshold)
                  if (set.underdogMinGap !== undefined) s.setUnderdogMinGap(set.underdogMinGap)
                  if (set.underdogBoostPct !== undefined) s.setUnderdogBoostPct(set.underdogBoostPct)
                  if (set.searchAutoSubmit !== undefined) { if (s.searchAutoSubmit !== set.searchAutoSubmit) s.toggleSearchAutoSubmit() }
                  if (set.smashPassStaticMode !== undefined) { if (s.smashPassStaticMode !== set.smashPassStaticMode) s.toggleSmashPassStatic() }
                  if (set.smashPassTags !== undefined) s.setSmashPassTags(set.smashPassTags)
                  if (set.smashPassTagsB !== undefined) s.setSmashPassTagsB(set.smashPassTagsB)
                  if (set.smashPassDualMode !== undefined) { if (s.smashPassDualMode !== set.smashPassDualMode) s.toggleSmashPassDualMode() }
                  if (set.terminatedMode !== undefined) { if (s.terminatedMode !== set.terminatedMode) s.toggleTerminatedMode() }
                  if (set.smashPassSwipeVote !== undefined) { if (s.smashPassSwipeVote !== set.smashPassSwipeVote) s.toggleSmashPassSwipeVote() }
                  if (set.galleryLayoutMode !== undefined) s.setGalleryLayoutMode(set.galleryLayoutMode)
                  if (set.carouselFloatingPanel !== undefined) { if (s.carouselFloatingPanel !== set.carouselFloatingPanel) s.toggleCarouselFloatingPanel() }
                  if (set.carouselNavSide !== undefined) s.setCarouselNavSide(set.carouselNavSide)
                  if (set.smashFloatingPanel !== undefined) { if (s.smashFloatingPanel !== set.smashFloatingPanel) s.toggleSmashFloatingPanel() }
                  if (set.smashNavSide !== undefined) s.setSmashNavSide(set.smashNavSide)
                  alert('Import complete — reload to apply all settings')
                } catch (e) { alert('Import failed: ' + String(e)) }
              }
              input.click()
            }}
          >
            Import from QR
          </button>
        </div>
      </details>

      <div className="text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <span className="font-mono">{__BUILD_TIMESTAMP__}</span>
        <span>{(() => { try { return window.matchMedia('(display-mode: standalone)').matches ? 'PWA' : 'Browser' } catch { return '' } })()}</span>
      </div>
    </div>
  )
}
