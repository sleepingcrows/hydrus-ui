import { useState } from 'react'
import { TagChip } from '../../components/TagChip'
import {
  getAllNamespaces,
  resolveNamespaceColor,
  setNamespaceColor,
  COLOR_CLASSES,
  type TagColor,
} from '../../utils/namespace-colors'

const COLOR_NAMES: TagColor[] = ['gray', 'blue', 'green', 'purple', 'amber', 'pink', 'indigo', 'teal', 'red', 'orange']

export function NamespaceColorsConfig() {
  const [namespaces, setNamespaces] = useState(getAllNamespaces)
  const [customNs, setCustomNs] = useState('')

  function handleChange(ns: string, color: TagColor) {
    setNamespaceColor(ns, color)
    setNamespaces(getAllNamespaces())
  }

  function handleAdd() {
    const ns = customNs.trim().toLowerCase()
    if (!ns) return
    handleChange(ns, 'blue')
    setCustomNs('')
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4 text-gray-900 dark:text-gray-100">
      <h2 className="text-lg font-bold">Namespace Colors</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Assign colors to tag namespaces. Tags like <code>character:frieren</code> use chosen color.
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={customNs}
          onChange={(e) => setCustomNs(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Add namespace..."
          className="flex-1 border dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400"
          autoCapitalize="off"
          autoComplete="off"
          inputMode="text"
        />
        <button
          className="px-3 py-1 min-h-[44px] bg-blue-600 text-white rounded text-sm disabled:opacity-50 hover:bg-blue-700 active:bg-blue-800"
          onClick={handleAdd}
          disabled={!customNs.trim()}
        >
          Add
        </button>
      </div>

      <div className="space-y-2">
        {namespaces.length === 0 && (
          <div className="text-sm text-gray-400">No namespaces configured.</div>
        )}
        {namespaces.map((ns) => {
          const currentColor = resolveNamespaceColor(ns)
          return (
            <div key={ns} className="flex items-center gap-2">
              <TagChip tag={`${ns}:example`} size="sm" />
              <span className="text-xs text-gray-500 dark:text-gray-400 w-20 truncate">{ns}</span>
              <div className="flex gap-1">
                {COLOR_NAMES.map((c) => (
                  <button
                    key={c}
                    className={`w-9 h-9 min-w-[44px] min-h-[44px] rounded-full border-2 ${
                      c === currentColor ? 'border-gray-900 dark:border-gray-100' : 'border-transparent'
                    } ${COLOR_CLASSES[c].bg} hover:opacity-80 active:opacity-60`}
                    onClick={() => handleChange(ns, c)}
                    title={c}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
