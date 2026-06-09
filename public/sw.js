const CACHE = 'hydrus-ui-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/get_files/') || url.pathname.startsWith('/api_version') || url.pathname.startsWith('/search_files')) {
    event.respondWith(fetch(event.request).catch(() => new Response(null, { status: 503 })))
    return
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok && response.type === 'basic' && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/get_files/')) {
        const clone = response.clone()
        caches.open(CACHE).then((cache) => cache.put(event.request, clone))
      }
      return response
    }).catch(() => caches.match('/index.html')))
  )
})
