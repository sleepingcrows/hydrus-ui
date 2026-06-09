import { getNamespaceColorName } from '../utils/namespace-colors'
import type { TagColor } from '../utils/namespace-colors'

interface TagChipProps {
  tag: string
  onRemove?: () => void
  size?: 'sm' | 'md'
}

const SIZE_CLASSES = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'min-h-[44px] px-2 py-0.5 text-sm',
}

const COLOR_MAP: Record<TagColor, string> = {
  gray:   'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100',
  blue:   'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
  green:  'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
  purple: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
  amber:  'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200',
  pink:   'bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200',
  indigo: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200',
  teal:   'bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200',
  red:    'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
  orange: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
}

export function TagChip({ tag, onRemove, size = 'md' }: TagChipProps) {
  const colorName = getNamespaceColorName(tag)

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full cursor-pointer ${SIZE_CLASSES[size]} ${COLOR_MAP[colorName]}`}
      onClick={onRemove}
      title={onRemove ? 'Click to remove' : tag}
    >
      {tag}
      {onRemove && <span className="text-xs ml-0.5">&times;</span>}
    </span>
  )
}
