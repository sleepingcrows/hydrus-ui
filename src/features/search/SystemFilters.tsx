import { useMobile } from '../../hooks/use-mobile'

interface SystemFiltersProps {
  tags: string[]
  onTagsChange: (tags: string[]) => void
}

const STATUS_FILTERS = [
  { label: 'Inbox', tag: 'system:inbox' },
  { label: 'Archive', tag: 'system:archive' },
] as const

const FILETYPE_FILTERS = [
  { label: 'Images', tag: 'system:filetype is image' },
  { label: 'Video', tag: 'system:filetype is video' },
  { label: 'Audio', tag: 'system:filetype is audio' },
] as const

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`text-xs rounded-full px-2.5 py-1 min-h-[28px] transition-colors ${
        active
          ? 'bg-blue-500 text-white'
          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export function SystemFilters({ tags, onTagsChange }: SystemFiltersProps) {
  const { isMobile } = useMobile()

  function toggleTag(tag: string) {
    if (tags.includes(tag)) {
      onTagsChange(tags.filter((t) => t !== tag))
    } else {
      onTagsChange([...tags, tag])
    }
  }

  function toggleStatus(tag: string) {
    const statusTags = STATUS_FILTERS.map((f) => f.tag)
    const activeStatus = tags.filter((t) => statusTags.includes(t))
    if (tags.includes(tag)) {
      onTagsChange(tags.filter((t) => t !== tag))
    } else {
      const withoutStatus = tags.filter((t) => !statusTags.includes(t))
      onTagsChange([...withoutStatus, tag])
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${isMobile ? 'px-1' : ''}`}>
      {STATUS_FILTERS.map((f) => (
        <Chip
          key={f.tag}
          label={f.label}
          active={tags.includes(f.tag)}
          onClick={() => toggleStatus(f.tag)}
        />
      ))}
      <span className="text-gray-300 dark:text-gray-600 text-xs mx-0.5">|</span>
      {FILETYPE_FILTERS.map((f) => (
        <Chip
          key={f.tag}
          label={f.label}
          active={tags.includes(f.tag)}
          onClick={() => toggleTag(f.tag)}
        />
      ))}
    </div>
  )
}
