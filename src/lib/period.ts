import { addDays, fmtDate, isoDate, MON, parseDate, toIso } from './format'

export type PKind = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom'
export interface Period { kind: PKind; anchor: string; from: string; to: string }
export const PERIODS: { kind: PKind; label: string }[] = [
  { kind: 'all', label: 'Semua' }, { kind: 'today', label: 'Hari ini' }, { kind: 'week', label: 'Minggu ini' },
  { kind: 'month', label: 'Bulan ini' }, { kind: 'year', label: 'Tahun ini' }, { kind: 'custom', label: 'Rentang' }
]
export const newPeriod = (kind: PKind, anchor = isoDate()): Period => ({ kind, anchor, from: anchor, to: anchor })

const sd = (s: string) => { const d = parseDate(s); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}` }
const yr = (s: string) => parseDate(s).getUTCFullYear()

export function range(p: Period): { from: string | null; to: string | null; label: string } {
  const d = parseDate(p.anchor), y = d.getUTCFullYear(), m = d.getUTCMonth()
  switch (p.kind) {
    case 'all': return { from: null, to: null, label: 'Semua waktu' }
    case 'today': return { from: p.anchor, to: p.anchor, label: fmtDate(p.anchor) }
    case 'week': {
      const from = addDays(p.anchor, -((d.getUTCDay() + 6) % 7)), to = addDays(from, 6)  // pekan mulai Senin
      return { from, to, label: `${sd(from)} – ${sd(to)} ${yr(to)}` }
    }
    case 'month': {
      const last = new Date(Date.UTC(y, m + 1, 0))
      return { from: toIso(new Date(Date.UTC(y, m, 1))), to: toIso(last), label: `1–${last.getUTCDate()} ${MON[m]} ${y}` }
    }
    case 'year': return { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y) }
    default: {
      const [a, b] = p.from <= p.to ? [p.from, p.to] : [p.to, p.from]
      return { from: a, to: b, label: `${sd(a)} – ${sd(b)} ${yr(b)}` }
    }
  }
}

export function shift(p: Period, dir: 1 | -1): Period {
  const d = parseDate(p.anchor)
  if (p.kind === 'today') return { ...p, anchor: addDays(p.anchor, dir) }
  if (p.kind === 'week') return { ...p, anchor: addDays(p.anchor, 7 * dir) }
  if (p.kind === 'month') return { ...p, anchor: toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + dir, 1))) }
  if (p.kind === 'year') return { ...p, anchor: toIso(new Date(Date.UTC(d.getUTCFullYear() + dir, 0, 1))) }
  return p
}
