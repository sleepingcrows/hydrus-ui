export interface Theme {
  id: string
  label: string
  type: 'light' | 'dark'
  preview: { bg: string; text: string; accent: string }
  colors: Record<string, string>
}

const lightGray = {
  '--color-white': '#ffffff', '--color-black': '#000000',
  '--color-gray-50': '#f9fafb', '--color-gray-100': '#f3f4f6',
  '--color-gray-200': '#e5e7eb', '--color-gray-300': '#d1d5db',
  '--color-gray-400': '#9ca3af', '--color-gray-500': '#6b7280',
  '--color-gray-600': '#4b5563', '--color-gray-700': '#374151',
  '--color-gray-800': '#1f2937', '--color-gray-900': '#111827',
  '--color-gray-950': '#030712',
}

const darkGray = {
  '--color-white': '#030712', '--color-black': '#f3f4f6',
  '--color-gray-50': '#030712', '--color-gray-100': '#111827',
  '--color-gray-200': '#1f2937', '--color-gray-300': '#374151',
  '--color-gray-400': '#4b5563', '--color-gray-500': '#6b7280',
  '--color-gray-600': '#9ca3af', '--color-gray-700': '#d1d5db',
  '--color-gray-800': '#e5e7eb', '--color-gray-900': '#f3f4f6',
  '--color-gray-950': '#f9fafb',
}

export const themes: Theme[] = [
  {
    id: 'classic-light', label: 'Classic Light', type: 'light',
    preview: { bg: '#ffffff', text: '#111827', accent: '#2563eb' },
    colors: { ...lightGray, '--color-blue-600': '#2563eb', '--color-blue-100': '#dbeafe' },
  },
  {
    id: 'paper', label: 'Paper', type: 'light',
    preview: { bg: '#fefcf5', text: '#1f1b14', accent: '#8b6914' },
    colors: {
      '--color-white': '#fffdf7', '--color-black': '#1f1b14',
      '--color-gray-50': '#fefcf5', '--color-gray-100': '#fdf8ed',
      '--color-gray-200': '#f5edd6', '--color-gray-300': '#e8dcc4',
      '--color-gray-400': '#c4b89c', '--color-gray-500': '#a0937a',
      '--color-gray-600': '#7a6e58', '--color-gray-700': '#5c5240',
      '--color-gray-800': '#3d362a', '--color-gray-900': '#1f1b14',
      '--color-gray-950': '#0f0d09',
      '--color-blue-600': '#8b6914', '--color-blue-100': '#f0e6c9',
    },
  },
  {
    id: 'solarized-light', label: 'Solarized Light', type: 'light',
    preview: { bg: '#fdf6e3', text: '#657b83', accent: '#268bd2' },
    colors: {
      '--color-white': '#fdf6e3', '--color-black': '#002b36',
      '--color-gray-50': '#fdf6e3', '--color-gray-100': '#eee8d5',
      '--color-gray-200': '#e8dcc4', '--color-gray-300': '#d5ccb3',
      '--color-gray-400': '#93a1a1', '--color-gray-500': '#839496',
      '--color-gray-600': '#657b83', '--color-gray-700': '#586e75',
      '--color-gray-800': '#073642', '--color-gray-900': '#002b36',
      '--color-gray-950': '#00161d',
      '--color-blue-600': '#268bd2', '--color-blue-100': '#d8eef9',
    },
  },
  {
    id: 'nord-light', label: 'Nord Light', type: 'light',
    preview: { bg: '#eceff4', text: '#2e3440', accent: '#5e81ac' },
    colors: {
      '--color-white': '#eceff4', '--color-black': '#2e3440',
      '--color-gray-50': '#eceff4', '--color-gray-100': '#e5e9f0',
      '--color-gray-200': '#d8dee9', '--color-gray-300': '#c9d0de',
      '--color-gray-400': '#a5abb6', '--color-gray-500': '#8a91a0',
      '--color-gray-600': '#6c7383', '--color-gray-700': '#4c5368',
      '--color-gray-800': '#3b4252', '--color-gray-900': '#2e3440',
      '--color-gray-950': '#1a1e2b',
      '--color-blue-600': '#5e81ac', '--color-blue-100': '#d7dee9',
    },
  },
  {
    id: 'catppuccin-latte', label: 'Catppuccin Latte', type: 'light',
    preview: { bg: '#eff1f5', text: '#1e2030', accent: '#1e66f5' },
    colors: {
      '--color-white': '#eff1f5', '--color-black': '#1e2030',
      '--color-gray-50': '#eff1f5', '--color-gray-100': '#e6e9ef',
      '--color-gray-200': '#ccd0da', '--color-gray-300': '#bcc0cc',
      '--color-gray-400': '#9ca0b0', '--color-gray-500': '#7c7f93',
      '--color-gray-600': '#5c5f77', '--color-gray-700': '#414559',
      '--color-gray-800': '#2a2e3c', '--color-gray-900': '#1e2030',
      '--color-gray-950': '#121321',
      '--color-blue-600': '#1e66f5', '--color-blue-100': '#dce0f8',
    },
  },
  {
    id: 'classic-dark', label: 'Classic Dark', type: 'dark',
    preview: { bg: '#030712', text: '#f3f4f6', accent: '#3b82f6' },
    colors: { ...darkGray, '--color-blue-600': '#3b82f6', '--color-blue-100': '#1e3a5f' },
  },
  {
    id: 'dracula', label: 'Dracula', type: 'dark',
    preview: { bg: '#282a36', text: '#f8f8f2', accent: '#bd93f9' },
    colors: {
      '--color-white': '#282a36', '--color-black': '#f8f8f2',
      '--color-gray-50': '#282a36', '--color-gray-100': '#2b2d3e',
      '--color-gray-200': '#3b3d51', '--color-gray-300': '#525472',
      '--color-gray-400': '#6272a4', '--color-gray-500': '#7a7c9a',
      '--color-gray-600': '#9a9cb5', '--color-gray-700': '#b8b9d0',
      '--color-gray-800': '#d8d8e8', '--color-gray-900': '#f0f0f8',
      '--color-gray-950': '#f8f8f2',
      '--color-blue-600': '#bd93f9', '--color-blue-100': '#3b2d5e',
    },
  },
  {
    id: 'monokai', label: 'Monokai', type: 'dark',
    preview: { bg: '#272822', text: '#f8f8f2', accent: '#a6e22e' },
    colors: {
      '--color-white': '#272822', '--color-black': '#f8f8f2',
      '--color-gray-50': '#272822', '--color-gray-100': '#2e2f2a',
      '--color-gray-200': '#3e3f3a', '--color-gray-300': '#52534e',
      '--color-gray-400': '#75765e', '--color-gray-500': '#92937e',
      '--color-gray-600': '#a6a68e', '--color-gray-700': '#c0c0aa',
      '--color-gray-800': '#d8d8c6', '--color-gray-900': '#f0f0e2',
      '--color-gray-950': '#f8f8f2',
      '--color-blue-600': '#a6e22e', '--color-blue-100': '#3b4a1e',
    },
  },
  {
    id: 'solarized-dark', label: 'Solarized Dark', type: 'dark',
    preview: { bg: '#002b36', text: '#839496', accent: '#2aa198' },
    colors: {
      '--color-white': '#002b36', '--color-black': '#93a1a1',
      '--color-gray-50': '#002b36', '--color-gray-100': '#073642',
      '--color-gray-200': '#18424e', '--color-gray-300': '#2d4f5a',
      '--color-gray-400': '#586e75', '--color-gray-500': '#657b83',
      '--color-gray-600': '#839496', '--color-gray-700': '#93a1a1',
      '--color-gray-800': '#b3c0c2', '--color-gray-900': '#d5dbdb',
      '--color-gray-950': '#fdf6e3',
      '--color-blue-600': '#2aa198', '--color-blue-100': '#1a4f4a',
    },
  },
  {
    id: 'catppuccin-mocha', label: 'Catppuccin Mocha', type: 'dark',
    preview: { bg: '#1e1e2e', text: '#cdd6f4', accent: '#89b4fa' },
    colors: {
      '--color-white': '#1e1e2e', '--color-black': '#cdd6f4',
      '--color-gray-50': '#1e1e2e', '--color-gray-100': '#232438',
      '--color-gray-200': '#313244', '--color-gray-300': '#45475a',
      '--color-gray-400': '#585b70', '--color-gray-500': '#6c7086',
      '--color-gray-600': '#8b8fa8', '--color-gray-700': '#a6adc8',
      '--color-gray-800': '#c6cbe0', '--color-gray-900': '#e3e8f5',
      '--color-gray-950': '#cdd6f4',
      '--color-blue-600': '#89b4fa', '--color-blue-100': '#2a3b5e',
    },
  },
]

export function applyTheme(themeId: string) {
  const theme = themes.find((t) => t.id === themeId) ?? themes[0]
  const root = document.documentElement
  root.setAttribute('data-theme', themeId)
  const vars: Record<string, string> = {
    '--color-white': '#ffffff', '--color-black': '#000000',
    '--color-gray-50': '#f9fafb', '--color-gray-100': '#f3f4f6',
    '--color-gray-200': '#e5e7eb', '--color-gray-300': '#d1d5db',
    '--color-gray-400': '#9ca3af', '--color-gray-500': '#6b7280',
    '--color-gray-600': '#4b5563', '--color-gray-700': '#374151',
    '--color-gray-800': '#1f2937', '--color-gray-900': '#111827',
    '--color-gray-950': '#030712',
    '--color-blue-600': '#2563eb', '--color-blue-100': '#dbeafe',
  }
  Object.assign(vars, theme.colors)
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
  root.classList.remove('dark')
}
