const SW_PATH = '/sw.js'

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) {
    console.log('hydrus-ui: Service Worker not supported')
    return
  }

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as { standalone?: boolean }).standalone === true
  console.log('hydrus-ui: PWA mode:', isStandalone ? 'standalone' : 'browser tab')

  navigator.serviceWorker.register(SW_PATH).then((reg) => {
    console.log('hydrus-ui: SW registered, scope:', reg.scope)
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing
      if (!sw) return
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('hydrus-ui: new version available — reload to update')
        }
      })
    })
  }).catch((err) => {
    console.warn('hydrus-ui: SW registration failed:', err)
  })
}
