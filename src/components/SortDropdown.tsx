import { SORT_TYPE_LABELS, FILE_SORT_TYPES } from '../api/types'

interface Props {
  sortType: number
  sortAsc: boolean
  onSortTypeChange: (t: number) => void
  onSortAscChange: (a: boolean) => void
  includeRandom?: boolean
}

const SORT_OPTIONS = Object.values(FILE_SORT_TYPES).filter(
  (v): v is number => typeof v === 'number'
)

export function SortDropdown({ sortType, sortAsc, onSortTypeChange, onSortAscChange, includeRandom = true }: Props) {
  const options = includeRandom ? SORT_OPTIONS : SORT_OPTIONS.filter((t) => t !== FILE_SORT_TYPES.RANDOM)
  return (
    <div className="flex gap-1 items-center">
      <select
        className="text-sm border rounded px-2 py-1 min-h-[44px] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 dark:border-gray-600"
        value={sortType}
        onChange={(e) => onSortTypeChange(Number(e.target.value))}
      >
        {options.map((t) => (
          <option key={t} value={t}>{SORT_TYPE_LABELS[t] ?? String(t)}</option>
        ))}
      </select>
      <button
        className="text-sm px-2 py-1 min-h-[44px] min-w-[44px] border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600"
        title={sortAsc ? 'Ascending' : 'Descending'}
        onClick={() => onSortAscChange(!sortAsc)}
      >
        {sortAsc ? '\u2191' : '\u2193'}
      </button>
    </div>
  )
}
