// Permite que la app funcione sin internet y se actualice sola.
// - La app (index.html) siempre se busca primero en internet: si subiste una versión nueva a GitHub, se usa esa.
// - Si no hay conexión (o tarda más de 4 segundos), se abre la copia guardada en el teléfono.
// Ya no hace falta cambiar nada en este archivo cuando subas versiones nuevas.
const CACHE = 'entreno-v10';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const isPage = (req, url) => req.mode === 'navigate' || req.destination === 'document' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  // 'no-store' evita la copia temporal del navegador, así siempre llega lo último que subiste
  const net = fetch(req.url, { cache: 'no-store', credentials: 'same-origin' }).then(res => {
    if (res && res.ok) { cache.put(req.url, res.clone()); if (new URL(req.url).pathname.endsWith('/')) cache.put('./index.html', res.clone()); }
    return res;
  });
  try {
    const res = await Promise.race([net, new Promise((_, no) => setTimeout(() => no(new Error('lento')), 4000))]);
    if (res && res.ok) return res;
  } catch (e) {}
  return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./index.html')) || (await cache.match('./')) || net;
}

async function staleWhileRevalidate(req, e) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });
  const net = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
  if (cached) { e.waitUntil(net); return cached; }
  return (await net) || Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  // Solo los archivos de la app; los datos de tu cuenta (Supabase) siempre van directo a internet
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(isPage(req, url) ? networkFirst(req) : staleWhileRevalidate(req, e));
});
