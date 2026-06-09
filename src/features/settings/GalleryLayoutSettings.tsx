import { useSettingsStore } from '../../stores/settings-store'

export function GalleryLayoutSettings() {
  const galleryLayoutMode = useSettingsStore((s) => s.galleryLayoutMode)
  const setGalleryLayoutMode = useSettingsStore((s) => s.setGalleryLayoutMode)
  const carouselFloatingPanel = useSettingsStore((s) => s.carouselFloatingPanel)
  const carouselNavSide = useSettingsStore((s) => s.carouselNavSide)
  const toggleCarouselFloatingPanel = useSettingsStore((s) => s.toggleCarouselFloatingPanel)
  const setCarouselNavSide = useSettingsStore((s) => s.setCarouselNavSide)

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

      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 pt-2 border-t dark:border-gray-700">Carousel Controls</h3>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={carouselFloatingPanel}
          onChange={toggleCarouselFloatingPanel}
          className="rounded"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">Floating control panel</span>
      </label>
      {carouselFloatingPanel && (
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="carouselNavSide"
              value="left"
              checked={carouselNavSide === 'left'}
              onChange={() => setCarouselNavSide('left')}
              className="text-blue-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Left side</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="carouselNavSide"
              value="right"
              checked={carouselNavSide === 'right'}
              onChange={() => setCarouselNavSide('right')}
              className="text-blue-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Right side</span>
          </label>
        </div>
      )}
    </div>
  )
}