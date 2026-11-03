export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
export const DAY = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
export const DAYL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const nf = new Intl.NumberFormat('id-ID')
const p2 = (n: number) => String(n).padStart(2, '0')

export const num = (n: number) => nf.format(Math.round(n))
export const rp = (n: number) => (n < 0 ? '-' : '') + 'Rp ' + nf.format(Math.abs(Math.round(n)))
export const digits = (s: string) => s.replace(/\D/g, '')
export const parseAmount = (s: string) => { const d = digits(s); return d ? Number(d) : 0 }
export const group = (s: string) => { const d = digits(s).replace(/^0+(?=\d)/, ''); return d ? nf.format(Number(d)) : '' }

/** Tanggal lokal perangkat sebagai yyyy-MM-dd dan HH:mm */
export const isoDate = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
export const hhmm = (d = new Date()) => `${p2(d.getHours())}:${p2(d.getMinutes())}`

/** Aritmatika tanggal murni (UTC) agar bebas masalah zona waktu */
export const parseDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
export const toIso = (d: Date) => d.toISOString().slice(0, 10)
export const addDays = (s: string, n: number) => { const d = parseDate(s); d.setUTCDate(d.getUTCDate() + n); return toIso(d) }
export const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && toIso(parseDate(s)) === s && s >= '2000-01-01' && s <= '2100-12-31'
export const validTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s)

export const fmtDate = (s: string) => { const d = parseDate(s); return `${p2(d.getUTCDate())} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
export const fmtDay = (s: string) => { const d = parseDate(s); return `${DAYL[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
export const fmtStamp = (iso: string) => { if (!iso) return '-'; const d = new Date(iso); return `${p2(d.getDate())} ${MON[d.getMonth()]} ${hhmm(d)}` }
