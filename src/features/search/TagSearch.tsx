import { useState, type KeyboardEvent, useRef, useEffect } from 'react'
import { useTagSearch } from '../../hooks/use-tag-search'
import { TagChip } from '../../components/TagChip'
import { useSettingsStore } from '../../stores/settings-store'

const MAX_RESULTS = 100
const MAX_HISTORY = 10

interface TagSearchProps {
  tags: string[]
  onTagsChange: (tags: string[]) => void
  onSubmit?: () => void
  autoFocus?: boolean
}

export function TagSearch({ tags, onTagsChange, onSubmit, autoFocus }: TagSearchProps) {
  const [input, setInput] = useState('')
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const [isFocused, setIsFocused] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const { results, loading } = useTagSearch(input)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const displayed = results.slice(0, MAX_RESULTS)
  const searchHistory = useSettingsStore((s) => s.searchHistory)

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus()
  }, [autoFocus])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowHistory(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function addTag(tag: string) {
    if (!tags.includes(tag)) onTagsChange([...tags, tag])
    setInput('')
    setFocusedIdx(-1)
  }

  function removeTag(tag: string) {
    onTagsChange(tags.filter((t) => t !== tag))
  }

  function handleSubmit() {
    if (tags.length > 0) {
      useSettingsStore.getState().addToSearchHistory(tags)
    }
    onSubmit?.()
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      if (input) {
        if (focusedIdx >= 0 && focusedIdx < displayed.length) {
          addTag(displayed[focusedIdx])
        } else {
          addTag(input)
        }
      }
      handleSubmit()
    } else if (e.key === 'Enter' && input) {
      e.preventDefault()
      if (focusedIdx >= 0 && focusedIdx < displayed.length) {
        addTag(displayed[focusedIdx])
      } else {
        addTag(input)
      }
    } else if (e.key === 'Enter' && !input) {
      handleSubmit()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIdx((prev) => Math.min(prev + 1, displayed.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIdx((prev) => Math.max(prev - 1, -1))
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  return (
    <div className="flex flex-wrap gap-1 p-2 border rounded bg-white dark:bg-gray-800 dark:border-gray-600">
      {tags.map((tag) => (
        <TagChip key={tag} tag={tag} onRemove={() => removeTag(tag)} />
      ))}
      <div ref={containerRef} className="relative flex-1 min-w-[120px]">
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => { setIsFocused(false); setShowHistory(false) }}
            placeholder="Type a tag... Enter to add/search empty, Shift+Enter to search"
            className="flex-1 outline-none bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="search"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowHistory((s) => !s)}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="w-4 h-4" fill="currentColor">
              <path d="M320 128C426 128 512 214 512 320C512 426 426 512 320 512C254.8 512 197.1 479.5 162.4 429.7C152.3 415.2 132.3 411.7 117.8 421.8C103.3 431.9 99.8 451.9 109.9 466.4C156.1 532.6 233 576 320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C234.3 64 158.5 106.1 112 170.7L112 144C112 126.3 97.7 112 80 112C62.3 112 48 126.3 48 144L48 256C48 273.7 62.3 288 80 288L104.6 288C105.1 288 105.6 288 106.1 288L192.1 288C209.8 288 224.1 273.7 224.1 256C224.1 238.3 209.8 224 192.1 224L153.8 224C186.9 166.6 249 128 320 128zM344 216C344 202.7 333.3 192 320 192C306.7 192 296 202.7 296 216L296 320C296 326.4 298.5 332.5 303 337L375 409C384.4 418.4 399.6 418.4 408.9 409C418.2 399.6 418.3 384.4 408.9 375.1L343.9 310.1L343.9 216z"/>
            </svg>
          </button>
        </div>
        {isFocused && input && results.length > 0 && (
          <ul className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 dark:border-gray-600 border rounded shadow-lg">
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
        {showHistory && searchHistory.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 dark:border-gray-600 border rounded shadow-lg">
            <div className="px-2 py-1 text-[10px] text-gray-400 uppercase tracking-wider sticky top-0 bg-white dark:bg-gray-800">Recent</div>
            {searchHistory.slice(0, MAX_HISTORY).map((entry) => (
              <div
                key={JSON.stringify(entry)}
                className="min-h-[44px] px-2 py-1 text-xs cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700 active:bg-blue-100 dark:active:bg-gray-600 flex flex-wrap gap-1"
                onMouseDown={(e) => { e.preventDefault(); onTagsChange(entry); setShowHistory(false) }}
              >
                {entry.map((tag) => (
                  <span key={tag} className="text-gray-700 dark:text-gray-300">{tag}{' '}</span>
                ))}
              </div>
            ))}
          </div>
        )}
        {loading && <span className="absolute right-1 top-1 text-xs text-gray-400">...</span>}
      </div>
    </div>
  )
}
