/* Pre-Shift Check – offline cache.
   Ganti VERSION setiap kali index.html diperbarui, supaya HP crew mengambil versi baru. */
const VERSION = 'psc-2026-11-12k';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Halaman (index.html): ambil dari jaringan dulu (maks 4 detik) supaya selalu versi terbaru;
// tanpa sinyal -> pakai salinan di HP. File lain: salinan di HP dulu, diperbarui diam-diam.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;
  const isPage = req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname);
  e.respondWith(caches.open(VERSION).then(async c => {
    const key = isPage ? './index.html' : req;
    const net = fetch(req, isPage ? {cache: 'no-store'} : undefined)
      .then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(key, r.clone()); return r; }).catch(() => null);
    const hit = await c.match(key, {ignoreSearch: true});
    if (isPage) {
      const r = await Promise.race([net, new Promise(res => setTimeout(() => res(null), 4000))]);
      if (r && r.ok) return r;
      if (hit) { e.waitUntil(net); return hit; }
      return (await net) || new Response('Offline – open once with signal.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
    }
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || new Response('Offline', {status: 503});
  }));
});
