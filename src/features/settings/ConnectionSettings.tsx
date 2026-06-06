import { useState, useRef } from 'react'
import { useApiStore } from '../../stores/api-store'
import { useRatingServicesStore } from '../../stores/rating-services-store'
import { useSettingsStore } from '../../stores/settings-store'
import { testConnection } from '../../api/client'
import { NamespaceColorsConfig } from './NamespaceColorsConfig'

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
    <div className="max-w-md mx-auto p-6 space-y-4 text-gray-900 dark:text-gray-100">
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

      <hr className="border-gray-200 dark:border-gray-700" />
      <NamespaceColorsConfig />
    </div>
  )
}
