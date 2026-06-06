import { useSettingsStore } from '../../stores/settings-store'

export function GalleryLayoutSettings() {
  const galleryLayoutMode = useSettingsStore((s) => s.galleryLayoutMode)
  const setGalleryLayoutMode = useSettingsStore((s) => s.setGalleryLayoutMode)

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Gallery Layout</h3>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="galleryLayout"
            value="grid"
            checked={galleryLayoutMode === 'grid'}
            onChange={() => setGalleryLayoutMode('grid')}
            className="text-blue-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Grid</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="galleryLayout"
            value="mosaic"
            checked={galleryLayoutMode === 'mosaic'}
            onChange={() => setGalleryLayoutMode('mosaic')}
            className="text-blue-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Mosaic</span>
        </label>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Grid: fixed square cells. Mosaic: thumbnails keep aspect ratio, mesh together. (experimental)
      </p>
    </div>
  )
}