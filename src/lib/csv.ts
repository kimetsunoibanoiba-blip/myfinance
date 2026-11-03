import type { Data, Tx } from '../types'

const esc = (v: unknown) => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
/** Pemisah ';' dan BOM agar terbuka rapi di Excel (locale Indonesia) maupun Google Sheets. */
export const toCsv = (rows: unknown[][]) => '\uFEFF' + rows.map(r => r.map(esc).join(';')).join('\r\n')

export const txRows = (list: Tx[]) => [
  ['ID', 'Tanggal', 'Waktu', 'Jenis', 'Akun', 'Akun Tujuan', 'Kategori', 'Nominal', 'Catatan', 'Status'],
  ...list.map(t => [t.id, t.date, t.time, t.type, t.accountName, t.toAccountName, t.categoryName, t.amount, t.note, t.status])
]

export function download(name: string, text: string, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export interface Backup { format: 'myfinance-backup'; version: 1; exportedAt: string; data: Data }
export const makeBackup = (d: Data): Backup => ({ format: 'myfinance-backup', version: 1, exportedAt: new Date().toISOString(), data: d })

/** Validasi awal file backup di perangkat; validasi penuh tetap dilakukan backend. */
export function parseBackup(text: string): { ok: true; backup: Backup } | { ok: false; error: string } {
  let j: any
  try { j = JSON.parse(text) } catch { return { ok: false, error: 'File bukan JSON yang valid.' } }
  if (!j || j.format !== 'myfinance-backup' || j.version !== 1) return { ok: false, error: 'Ini bukan file backup MyFinance versi 1.' }
  const d = j.data
  if (!d || !['accounts', 'categories', 'transactions', 'notes'].every(k => Array.isArray(d[k]))) return { ok: false, error: 'Isi backup tidak lengkap.' }
  if (d.accounts.length + d.categories.length + d.transactions.length + d.notes.length > 20000) return { ok: false, error: 'Backup terlalu besar (maks. 20.000 baris).' }
  return { ok: true, backup: j as Backup }
}
