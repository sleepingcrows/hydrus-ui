import { useState } from 'react'
import { useSettingsStore } from '../../stores/settings-store'
import { useRatingServicesStore } from '../../stores/rating-services-store'
import type { HotkeyBinding } from '../../api/types'
import { SERVICE_TYPE } from '../../api/types'

const ACTION_LABELS: Record<string, string> = {
  'gallery-next': 'Gallery: Next file',
  'gallery-prev': 'Gallery: Previous file',
  'gallery-first': 'Gallery: First file',
  'gallery-last': 'Gallery: Last file',
  'toggle-fullscreen': 'Viewer: Toggle fullscreen',
  'toggle-info': 'Viewer: Toggle info panel',
  'focus-search': 'Search: Focus search bar',
  'smash': 'Smash/Pass: Smash',
  'pass': 'Smash/Pass: Pass',
  'skip': 'Smash/Pass: Skip',
  'archive': 'File: Archive',
  'delete-file': 'File: Delete',
  'show-cheatsheet': 'Help: Show hotkey cheat sheet',
  'toggle-dark': 'App: Toggle dark mode',
}

export function HotkeySettings() {
  const { hotkeys, setHotkey, resetHotkeys } = useSettingsStore()
  const ratingServices = useRatingServicesStore((s) => s.services)
  const [recording, setRecording] = useState<string | null>(null)

  function startRecord(actionId: string) {
    setRecording(actionId)
  }

  function handleKeyDown(e: React.KeyboardEvent, actionId: string) {
    if (recording !== actionId) return
    e.preventDefault()
    e.stopPropagation()
    const binding: HotkeyBinding = {
      key: e.key.toLowerCase() === ' ' ? ' ' : e.key.length === 1 ? e.key.toLowerCase() : e.key,
      ctrl: e.ctrlKey,
      shift: e.shiftKey,
      alt: e.altKey,
      meta: e.metaKey,
    }
    if (actionId.startsWith('rating-')) {
      const serviceKey = actionId.replace('rating-', '')
      binding.service_key = serviceKey
    }
    setHotkey(actionId, binding)
    setRecording(null)
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Hotkeys</h2>
        <button className="text-sm text-red-500 hover:text-red-700" onClick={resetHotkeys}>
          Reset to defaults
        </button>
      </div>

      <div className="space-y-1">
        {Object.entries(ACTION_LABELS).map(([id, label]) => {
          const binding = hotkeys.bindings[id]
          return (
            <div key={id} className="flex items-center justify-between py-1.5">
              <span className="text-sm">{label}</span>
              <button
                className={`px-3 py-1 text-xs font-mono border dark:border-gray-600 rounded min-w-[80px] text-center text-gray-900 dark:text-gray-100 ${
                  recording === id ? 'bg-yellow-100 dark:bg-yellow-900 border-yellow-500' : ''
                }`}
                onClick={() => startRecord(id)}
                onKeyDown={(e) => handleKeyDown(e, id)}
                tabIndex={0}
              >
                {recording === id ? '...' : binding ? formatKey(binding) : 'none'}
              </button>
            </div>
          )
        })}
      </div>

      {ratingServices.length > 0 && (
        <>
          <h3 className="font-bold text-sm mt-4">Rating Service Hotkeys</h3>
          <p className="text-xs text-gray-500">
            Each rating service gets assignable keys for increment and decrement.
          </p>
          {ratingServices.map((rs) => {
            const incId = `rating-inc-${rs.service_key}`
            const decId = `rating-dec-${rs.service_key}`
            const incBinding = hotkeys.bindings[incId]
            const decBinding = hotkeys.bindings[decId]
            const typeLabel =
              rs.type === SERVICE_TYPE.LIKE_DISLIKE_RATING ? 'Like/Dislike' :
              rs.type === SERVICE_TYPE.NUMERICAL_RATING ? `Numerical (${rs.min_stars}-${rs.max_stars})` :
              rs.type === SERVICE_TYPE.INC_DEC_RATING ? 'Inc/Dec' : 'Rating'

            return (
              <div key={rs.service_key} className="border dark:border-gray-600 rounded p-2 space-y-1">
                <div className="text-sm font-medium">{rs.name} <span className="text-xs text-gray-500">({typeLabel})</span></div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">Inc/Set:</span>
                    <button
                      className={`px-3 py-1 text-xs font-mono border dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 ${
                        recording === incId ? 'bg-yellow-100 dark:bg-yellow-900 border-yellow-500' : ''
                      }`}
                      onClick={() => startRecord(incId)}
                      onKeyDown={(e) => handleKeyDown(e, incId)}
                      tabIndex={0}
                    >
                      {recording === incId ? '...' : incBinding ? formatKey(incBinding) : 'none'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">Dec:</span>
                    <button
                      className={`px-3 py-1 text-xs font-mono border dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 ${
                        recording === decId ? 'bg-yellow-100 dark:bg-yellow-900 border-yellow-500' : ''
                      }`}
                      onClick={() => startRecord(decId)}
                      onKeyDown={(e) => handleKeyDown(e, decId)}
                      tabIndex={0}
                    >
                      {recording === decId ? '...' : decBinding ? formatKey(decBinding) : 'none'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

function formatKey(b: HotkeyBinding): string {
  const parts: string[] = []
  if (b.ctrl) parts.push('Ctrl')
  if (b.shift) parts.push('Shift')
  if (b.alt) parts.push('Alt')
  if (b.meta) parts.push('Meta')
  parts.push(b.key.length === 1 ? b.key.toUpperCase() : b.key)
  return parts.join('+')
}
