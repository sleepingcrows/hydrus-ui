const SW_PATH = '/sw.js'

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return

  navigator.serviceWorker.register(SW_PATH).then((reg) => {
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing
      if (!sw) return
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('hydrus-ui: new version available — reload to update')
        }
      })
    })
  }).catch(() => {})
}
