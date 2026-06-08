import { themes } from '../../themes'
import { useSettingsStore } from '../../stores/settings-store'

interface Props {
  onClose: () => void
}

export function ThemeSettingsModal({ onClose }: Props) {
  const currentTheme = useSettingsStore((s) => s.themeName)
  const setTheme = useSettingsStore((s) => s.setTheme)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-xl w-full mx-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-base font-bold">Themes</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">&times;</button>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {themes.map((t) => {
            const active = currentTheme === t.id
            return (
              <button
                key={t.id}
                onClick={() => { setTheme(t.id); onClose() }}
                className={`relative rounded-lg border-2 p-3 text-left transition-all ${
                  active ? 'border-blue-500 ring-2 ring-blue-400' : 'border-transparent hover:border-gray-400 dark:hover:border-gray-500'
                }`}
                style={{ backgroundColor: t.preview.bg }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: t.preview.accent }} />
                  <span className="text-xs font-medium" style={{ color: t.preview.text }}>{t.label}</span>
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full opacity-60" style={{ backgroundColor: t.preview.text, width: '70%' }} />
                  <div className="h-1.5 rounded-full opacity-40" style={{ backgroundColor: t.preview.text, width: '50%' }} />
                  <div className="h-1.5 rounded-full opacity-20" style={{ backgroundColor: t.preview.text, width: '85%' }} />
                </div>
                <span className="text-[10px] mt-2 block opacity-50" style={{ color: t.preview.text }}>
                  {t.type}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
