export type TagColor = 'gray' | 'blue' | 'green' | 'purple' | 'amber' | 'pink' | 'indigo' | 'teal' | 'red' | 'orange'

export const COLOR_CLASSES: Record<TagColor, { bg: string; text: string }> = {
  gray:   { bg: 'bg-gray-200 dark:bg-gray-700', text: 'text-gray-900 dark:text-gray-100' },
  blue:   { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200' },
  green:  { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-800 dark:text-purple-200' },
  amber:  { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-800 dark:text-amber-200' },
  pink:   { bg: 'bg-pink-100 dark:bg-pink-900', text: 'text-pink-800 dark:text-pink-200' },
  indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900', text: 'text-indigo-800 dark:text-indigo-200' },
  teal:   { bg: 'bg-teal-100 dark:bg-teal-900', text: 'text-teal-800 dark:text-teal-200' },
  red:    { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-800 dark:text-orange-200' },
}

const STORAGE_KEY = 'namespace-colors'
const DEFAULT_NAMESPACE_COLORS: Record<string, TagColor> = {
  character: 'blue',
  series: 'green',
  artist: 'purple',
  rating: 'amber',
  studio: 'pink',
  creator: 'indigo',
  meta: 'teal',
  person: 'blue',
  language: 'teal',
  species: 'orange',
  copyright: 'red',
  cosplayer: 'pink',
  gender: 'purple',
  style: 'indigo',
}

function getNamespace(tag: string): string | null {
  const idx = tag.indexOf(':')
  if (idx <= 0) return null
  return tag.slice(0, idx)
}

function loadOverrides(): Record<string, TagColor> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function mergedConfig(): Record<string, TagColor> {
  return { ...DEFAULT_NAMESPACE_COLORS, ...loadOverrides() }
}

export function getTagColor(tag: string): string {
  return getNamespaceColor(tag)
}

export function getNamespaceColorName(tag: string): TagColor {
  const ns = getNamespace(tag)
  if (!ns) return 'gray'
  return resolveNamespaceColor(ns)
}

export function getNamespaceColor(ns: string): string {
  const color = resolveNamespaceColor(ns)
  return combine(COLOR_CLASSES[color])
}

export function resolveNamespaceColor(ns: string): TagColor {
  const config = mergedConfig()
  return config[ns.toLowerCase()] || 'gray'
}

export function setNamespaceColor(ns: string, color: TagColor) {
  const overrides = loadOverrides()
  if (color === DEFAULT_NAMESPACE_COLORS[ns.toLowerCase()]) {
    delete overrides[ns.toLowerCase()]
  } else {
    overrides[ns.toLowerCase()] = color
  }
  if (Object.keys(overrides).length === 0) {
    localStorage.removeItem(STORAGE_KEY)
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  }
}

function combine(c: { bg: string; text: string }): string {
  return `${c.bg} ${c.text}`
}

export function getAllNamespaces(): string[] {
  const keys = new Set<string>()
  for (const k of Object.keys(DEFAULT_NAMESPACE_COLORS)) keys.add(k)
  for (const k of Object.keys(loadOverrides())) keys.add(k)
  return [...keys].sort()
}

export { DEFAULT_NAMESPACE_COLORS, STORAGE_KEY }
