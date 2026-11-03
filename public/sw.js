/* MyFinance service worker.
 * - Cangkang aplikasi (HTML/JS/CSS/ikon) disimpan agar aplikasi terbuka walau offline.
 * - Panggilan ke Google Apps Script TIDAK PERNAH disimpan: data keuangan selalu dari Google Sheets.
 * Naikkan VERSION setiap kali ingin memaksa semua perangkat memuat ulang cache. */
const VERSION = 'myfinance-v1'
const SHELL = ['./', 'offline.html', 'manifest.webmanifest', 'icons/icon-192.png']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (/(^|\.)script\.google\.com$|(^|\.)googleusercontent\.com$/.test(url.hostname)) return   // API: jangan di-cache

  if (req.mode === 'navigate') {
    // Cangkang aplikasi: coba jaringan dulu; bila offline atau server mengembalikan error (404/5xx), pakai salinan tersimpan.
    const scopePath = new URL(self.registration.scope).pathname
    const shell = () => caches.match('./').then(r => r || caches.match('offline.html'))
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            if (url.pathname === scopePath || url.pathname.endsWith('/index.html')) { const copy = res.clone(); caches.open(VERSION).then(c => c.put('./', copy)) }
            return res
          }
          return shell().then(r => r || res)
        })
        .catch(shell)
    )
    return
  }

  const same = url.origin === self.location.origin
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (!same && !font) return
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req)
        .then(res => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)) } return res })
        .catch(() => hit)
      return hit || net
    })
  )
})
