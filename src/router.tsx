import { useEffect, useState } from 'react'

export interface Route { path: string; parts: string[]; q: URLSearchParams }

const parse = (): Route => {
  const h = location.hash.replace(/^#/, '') || '/'
  const [p, qs] = h.split('?')
  const parts = p.split('/').filter(Boolean)
  return { path: '/' + parts.join('/'), parts, q: new URLSearchParams(qs || '') }
}

/** Router berbasis hash (#/transaksi) sehingga aplikasi bisa di-host di mana saja tanpa pengaturan server. */
export function useRoute(): Route {
  const [r, setR] = useState<Route>(parse)
  useEffect(() => {
    const f = () => setR(parse())
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return r
}

export const go = (to: string, replace = false) => { if (replace) location.replace('#' + to); else location.hash = to }
export const back = (fallback = '/') => { if (history.length > 1) history.back(); else go(fallback, true) }
