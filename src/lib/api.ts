import type { Cfg } from '../types'

export class ApiErr extends Error {
  constructor(public code: string, msg: string, public retry = false) { super(msg) }
}

const GAS = /^https:\/\/script\.google\.com\/(a\/macros\/[^/]+|macros)\/s\/[A-Za-z0-9_-]+\/exec$/
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1):\d+\//
/** Hanya alamat Web App Google yang diterima (localhost hanya saat pengembangan di komputer sendiri). */
export const okUrl = (u: string) => { const s = u.trim(); return GAS.test(s) || (LOCAL.test(s) && ['localhost', '127.0.0.1'].includes(location.hostname)) }

/**
 * Memanggil Web App Apps Script. Content-Type text/plain menghindari preflight CORS (Apps Script tidak menjawab OPTIONS).
 * Kesalahan jaringan/waktu habis ditandai retry=true agar permintaan tetap di antrean dan dikirim ulang.
 */
export async function call<T = unknown>(cfg: Cfg, action: string, payload: unknown = {}, ms = 20000): Promise<T> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), ms)
  let status = 0
  let text = ''
  try {
    const res = await fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, key: cfg.key, payload }), redirect: 'follow', signal: ctl.signal })
    status = res.status
    text = await res.text()
  } catch {
    throw new ApiErr('network', 'Tidak dapat terhubung ke Google Sheets. Periksa koneksi internet.', true)
  } finally {
    clearTimeout(timer)
  }
  let j: { ok?: boolean; data?: T; error?: { code: string; message: string } }
  try { j = JSON.parse(text) } catch {
    throw new ApiErr('bad_response', 'Balasan server tidak dikenali. Pastikan URL Web App benar (berakhiran /exec) dan akses deployment diatur ke "Siapa saja".', status >= 500)
  }
  if (j.ok) return j.data as T
  const e = j.error ?? { code: 'internal', message: 'Kesalahan tidak diketahui.' }
  throw new ApiErr(e.code, e.message, e.code === 'busy')
}
