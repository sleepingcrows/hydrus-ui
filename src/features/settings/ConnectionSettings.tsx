import { useState, useRef } from 'react'
import { useApiStore } from '../../stores/api-store'
import { useRatingServicesStore } from '../../stores/rating-services-store'
import { useSettingsStore } from '../../stores/settings-store'
import { testConnection } from '../../api/client'
import { NamespaceColorsConfig } from './NamespaceColorsConfig'
import { GalleryLayoutSettings } from './GalleryLayoutSettings'
import { SERVICE_TYPE } from '../../api/types'

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
    </div>
  )
}
