// Service worker de Arma Tu Cancha. Hace dos cosas:
//   1. Los archivos de /assets/ (tienen hash en el nombre) se sirven de la caché.
//   2. La página siempre se pide a la red; sin internet se abre la última copia.
// Nunca toca Supabase ni otros dominios: horarios y reservas siempre van en vivo.
const CACHE = 'atc-v1'
const PAGINA = new URL('./', self.registration.scope).href
const MAX_ARCHIVOS = 80

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(PAGINA)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

async function pagina(request) {
  const cache = await caches.open(CACHE)
  try {
    const respuesta = await fetch(request)
    if (respuesta.ok) await cache.put(PAGINA, respuesta.clone())
    return respuesta
  } catch {
    return (await cache.match(PAGINA)) ?? Response.error()
  }
}

async function archivo(request) {
  const cache = await caches.open(CACHE)
  const guardado = await cache.match(request)
  if (guardado) return guardado

  const respuesta = await fetch(request)
  if (respuesta.ok) {
    await cache.put(request, respuesta.clone())
    // Cada versión nueva deja archivos viejos: se borran los más antiguos.
    const claves = (await cache.keys()).filter((k) => k.url !== PAGINA)
    await Promise.all(claves.slice(0, Math.max(0, claves.length - MAX_ARCHIVOS)).map((k) => cache.delete(k)))
  }
  return respuesta
}

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') e.respondWith(pagina(request))
  else if (url.pathname.includes('/assets/')) e.respondWith(archivo(request))
})
