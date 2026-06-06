import { useState, type KeyboardEvent, useRef, useEffect } from 'react'
import { useTagSearch } from '../../hooks/use-tag-search'
import { TagChip } from '../../components/TagChip'

const MAX_RESULTS = 100

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
  const { results, loading } = useTagSearch(input)
  const inputRef = useRef<HTMLInputElement>(null)
  const displayed = results.slice(0, MAX_RESULTS)

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus()
  }, [autoFocus])

  function addTag(tag: string) {
    if (!tags.includes(tag)) onTagsChange([...tags, tag])
    setInput('')
    setFocusedIdx(-1)
  }

  function removeTag(tag: string) {
    onTagsChange(tags.filter((t) => t !== tag))
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
      onSubmit?.()
    } else if (e.key === 'Enter' && input) {
      e.preventDefault()
      if (focusedIdx >= 0 && focusedIdx < displayed.length) {
        addTag(displayed[focusedIdx])
      } else {
        addTag(input)
      }
    } else if (e.key === 'Enter' && !input) {
      onSubmit?.()
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
      <div className="relative flex-1 min-w-[120px]">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Type a tag... Enter to add/search empty, Shift+Enter to search"
          className="w-full outline-none bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
        />
        {isFocused && input && results.length > 0 && (
          <ul className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 dark:border-gray-600 border rounded shadow-lg">
            {displayed.map((tag, i) => (
              <li
                key={tag}
                className={`px-2 py-1 text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700 ${
                  i === focusedIdx ? 'bg-blue-50 dark:bg-gray-600' : ''
                }`}
                onMouseDown={(e) => { e.preventDefault(); addTag(tag) }}
              >
                <TagChip tag={tag} size="sm" />
              </li>
            ))}
          </ul>
        )}
        {loading && <span className="absolute right-1 top-1 text-xs text-gray-400">...</span>}
      </div>
    </div>
  )
}
