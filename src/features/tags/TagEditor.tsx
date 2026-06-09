import { useState, useEffect, useRef, type KeyboardEvent } from 'react'
import { useTagSearch } from '../../hooks/use-tag-search'
import { useTagServicesStore } from '../../stores/tag-services-store'
import { addTags, cleanTags } from '../../api/tags'
import { getFileUrl, fetchFileMetadata } from '../../api/search'
import { TagChip } from '../../components/TagChip'
import type { FileMetadata } from '../../api/types'

interface TagEditorProps {
  file: FileMetadata
  onClose: () => void
  onSaved: (serviceKey: string, tags: string[]) => Promise<void> | void
}

function extractServiceTags(file: FileMetadata, serviceKey: string): string[] {
  const entry = file.tags?.[serviceKey]
  if (!entry) return []
  const seen = new Set<string>()
  for (const list of Object.values(entry.display_tags)) {
    for (const tag of list) {
      if (!seen.has(tag)) seen.add(tag)
    }
  }
  for (const list of Object.values(entry.storage_tags)) {
    for (const tag of list) {
      if (!seen.has(tag)) seen.add(tag)
    }
  }
  return [...seen]
}

function getApplicableServices(file: FileMetadata, available: { service_key: string; name: string }[]): { service_key: string; name: string }[] {
  const fileServiceKeys = file.tags ? Object.keys(file.tags) : []
  const matched = available.filter((s) => fileServiceKeys.includes(s.service_key))
  const unmatched = available.filter((s) => !fileServiceKeys.includes(s.service_key))
  return [...matched, ...unmatched]
}

export function TagEditor({ file, onClose, onSaved }: TagEditorProps) {
  const [input, setInput] = useState('')
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [selectedServiceKey, setSelectedServiceKey] = useState<string>('')
  const [workingTags, setWorkingTags] = useState<string[]>([])
  const [originalTags, setOriginalTags] = useState<string[]>([])
  const [services, setServices] = useState<{ service_key: string; name: string }[]>([])
  const { results, loading: searchLoading } = useTagSearch(input)
  const inputRef = useRef<HTMLInputElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const pristineRef = useRef(true)
  const freshMetaRef = useRef<FileMetadata | null>(null)
  const displayed = results.slice(0, 100)

  function applyTagsFromMeta(meta: FileMetadata, serviceKey: string) {
    const tags = extractServiceTags(meta, serviceKey)
    setWorkingTags(tags)
    setOriginalTags(tags)
  }

  useEffect(() => {
    const store = useTagServicesStore.getState()
    if (store.services.length === 0) {
      store.load().then(() => {
        const all = useTagServicesStore.getState().services
        setServices(getApplicableServices(file, all))
      })
    } else {
      setServices(getApplicableServices(file, store.services))
    }
  }, [file])

  useEffect(() => {
    if (!fileUrl) {
      getFileUrl(file.hash).then(setFileUrl).catch(() => {})
    }
  }, [file.hash, fileUrl])

  useEffect(() => {
    if (services.length > 0 && !selectedServiceKey) {
      setSelectedServiceKey(services[0].service_key)
    }
  }, [services, selectedServiceKey])

  useEffect(() => {
    if (!selectedServiceKey) return
    let cancelled = false
    fetchFileMetadata([file.hash]).then((meta) => {
      if (cancelled || meta.length === 0) return
      freshMetaRef.current = meta[0]
      if (!cancelled) applyTagsFromMeta(meta[0], selectedServiceKey)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [file.hash])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  function handleServiceChange(serviceKey: string) {
    setSelectedServiceKey(serviceKey)
    pristineRef.current = false
    setError(null)
    const cached = freshMetaRef.current
    if (cached) {
      applyTagsFromMeta(cached, serviceKey)
    } else {
      const tags = extractServiceTags(file, serviceKey)
      setWorkingTags(tags)
      setOriginalTags(tags)
    }
    setInput('')
  }

  function addTag(tag: string) {
    pristineRef.current = false
    if (!workingTags.includes(tag)) {
      setWorkingTags([...workingTags, tag])
    }
    setInput('')
    setFocusedIdx(-1)
    inputRef.current?.focus()
  }

  function removeTag(tag: string) {
    pristineRef.current = false
    setWorkingTags(workingTags.filter((t) => t !== tag))
  }

  async function handleSave() {
    if (!selectedServiceKey) return
    setSaving(true)
    setError(null)
    try {
      const added = workingTags.filter((t) => !originalTags.includes(t))
      const removed = originalTags.filter((t) => !workingTags.includes(t))
      const actions: Record<number, string[]> = {}
      if (added.length > 0) actions[0] = await cleanTags(added)
      if (removed.length > 0) actions[1] = await cleanTags(removed)
      if (Object.keys(actions).length === 0) {
        setSaving(false)
        onClose()
        return
      }
      const identifier = file.hash ? { hash: file.hash } : { file_id: file.file_id }
      await addTags(identifier, { [selectedServiceKey]: actions })
      const cleanedAll = await cleanTags(workingTags)
      await onSaved(selectedServiceKey, cleanedAll)
      onClose()
    } catch (e) {
      setError(String(e))
      setSaving(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && input) {
      e.preventDefault()
      if (focusedIdx >= 0 && focusedIdx < displayed.length) {
        addTag(displayed[focusedIdx])
      } else {
        addTag(input)
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIdx((prev) => Math.min(prev + 1, displayed.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIdx((prev) => Math.max(prev - 1, -1))
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col">
      <div className="flex-1 relative min-h-0 bg-black/60">
        {fileUrl ? (
          <img src={fileUrl} alt=""
            className="w-full h-full object-contain"
            onClick={() => onClose()}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30 text-sm">Loading...</div>
        )}
      </div>
      <div
        ref={sheetRef}
        className="bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl max-h-[55vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Edit Tags</h2>
          <button
            className="min-h-[44px] min-w-[44px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Tag service</label>
            <select
              value={selectedServiceKey}
              onChange={(e) => handleServiceChange(e.target.value)}
              className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
            >
              {services.map((s) => (
                <option key={s.service_key} value={s.service_key}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              Tags ({workingTags.length})
            </label>
            <div className="flex flex-wrap gap-1.5 min-h-[36px] p-1.5 border rounded bg-gray-50 dark:bg-gray-800 dark:border-gray-600">
              {workingTags.length === 0 && (
                <span className="text-xs text-gray-400 py-1">No tags — add some below</span>
              )}
              {workingTags.map((tag) => (
                <TagChip key={tag} tag={tag} onRemove={() => removeTag(tag)} size="sm" />
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => { setInput(e.target.value); setFocusedIdx(-1) }}
                onKeyDown={handleKeyDown}
                placeholder="Type tag name..."
                className="flex-1 border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <button
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50 hover:bg-blue-700 active:bg-blue-800"
                onClick={() => { if (input) addTag(input) }}
                disabled={!input}
              >
                Add
              </button>
            </div>
            {input && displayed.length > 0 && (
              <ul className="absolute z-10 top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white dark:bg-gray-800 dark:border-gray-600 border rounded shadow-lg">
                {displayed.map((tag, i) => (
                  <li
                    key={tag}
                    className={`min-h-[44px] px-2 py-1 text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700 active:bg-blue-100 dark:active:bg-gray-600 ${
                      i === focusedIdx ? 'bg-blue-50 dark:bg-gray-600' : ''
                    }`}
                    onMouseDown={(e) => { e.preventDefault(); addTag(tag) }}
                  >
                    <TagChip tag={tag} size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <div className="text-red-500 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-2 py-1.5">
              {error}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50 hover:bg-blue-700 active:bg-blue-800 min-h-[44px]"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              className="px-3 py-2 border dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700 min-h-[44px]"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
