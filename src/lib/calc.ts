import type { Balances, Data, Tx, TxType } from '../types'
import { addDays, DAY, isoDate, MON, parseDate, toIso } from './format'

export const alive = <T extends { status: string }>(a: T[]) => a.filter(x => x.status === 'Aktif')

/** Saldo per akun = saldo awal + pemasukan - pengeluaran +/- transfer. Transfer tidak masuk total pemasukan/pengeluaran. */
export function balances(d: Data): Balances {
  const acc: Record<string, number> = {}
  alive(d.accounts).forEach(a => { acc[a.id] = a.openingBalance })
  let income = 0, expense = 0
  const add = (id: string, v: number) => { if (id in acc) acc[id] += v }
  alive(d.transactions).forEach(t => {
    if (t.type === 'Pemasukan') { add(t.accountId, t.amount); income += t.amount }
    else if (t.type === 'Pengeluaran') { add(t.accountId, -t.amount); expense += t.amount }
    else { add(t.accountId, -t.amount); add(t.toAccountId, t.amount) }
  })
  return { accounts: acc, income, expense, total: Object.values(acc).reduce((s, v) => s + v, 0) }
}

export interface Totals { income: number; expense: number; transfer: number; opening: number; closing: number }
/** Ringkasan satu periode untuk semua akun ('all') atau satu akun. opening = "saldo sebelumnya". */
export function totals(d: Data, from: string | null, to: string | null, accountId = 'all'): Totals {
  const ids = new Set(alive(d.accounts).map(a => a.id))
  const scope = accountId === 'all'
  let opening = scope ? alive(d.accounts).reduce((s, a) => s + a.openingBalance, 0) : (d.accounts.find(a => a.id === accountId)?.openingBalance ?? 0)
  let income = 0, expense = 0, transfer = 0
  for (const t of alive(d.transactions)) {
    if (!ids.has(t.accountId) || (t.type === 'Transfer' && !ids.has(t.toAccountId))) continue
    let eff: number
    if (scope) eff = t.type === 'Pemasukan' ? t.amount : t.type === 'Pengeluaran' ? -t.amount : 0
    else if (t.accountId === accountId) eff = t.type === 'Pemasukan' ? t.amount : -t.amount
    else if (t.type === 'Transfer' && t.toAccountId === accountId) eff = t.amount
    else continue
    if (from && t.date < from) { opening += eff; continue }
    if (to && t.date > to) continue
    if (t.type === 'Pemasukan') income += t.amount
    else if (t.type === 'Pengeluaran') expense += t.amount
    else transfer += eff
  }
  return { income, expense, transfer, opening, closing: opening + income - expense + transfer }
}

export interface Filter { q: string; type: '' | TxType; accountId: string; categoryId: string; from: string | null; to: string | null; sort: 'new' | 'old' }
export const noFilter: Filter = { q: '', type: '', accountId: '', categoryId: '', from: null, to: null, sort: 'new' }
export const sortKey = (t: Tx) => `${t.date} ${t.time} ${t.createdAt}`

export function filterTx(list: Tx[], f: Filter): Tx[] {
  const q = f.q.trim().toLowerCase(), qd = q.replace(/\D/g, '')
  return list.filter(t => {
    if (f.type && t.type !== f.type) return false
    if (f.accountId && t.accountId !== f.accountId && t.toAccountId !== f.accountId) return false
    if (f.categoryId && t.categoryId !== f.categoryId) return false
    if (f.from && t.date < f.from) return false
    if (f.to && t.date > f.to) return false
    if (!q) return true
    const hay = [t.note, t.categoryName, t.accountName, t.toAccountName, t.type, ...t.items.map(i => i.name)].join(' ').toLowerCase()
    return hay.includes(q) || (qd !== '' && String(t.amount).includes(qd))
  }).sort((a, b) => (f.sort === 'new' ? sortKey(b).localeCompare(sortKey(a)) : sortKey(a).localeCompare(sortKey(b))))
}

export interface DayGroup { date: string; items: Tx[]; income: number; expense: number }
export function groupByDate(list: Tx[]): DayGroup[] {
  const m = new Map<string, DayGroup>()
  for (const t of list) {
    let g = m.get(t.date)
    if (!g) { g = { date: t.date, items: [], income: 0, expense: 0 }; m.set(t.date, g) }
    g.items.push(t)
    if (t.type === 'Pemasukan') g.income += t.amount
    else if (t.type === 'Pengeluaran') g.expense += t.amount
  }
  return [...m.values()]
}

export function byCategory(list: Tx[], type: 'Pemasukan' | 'Pengeluaran') {
  const m = new Map<string, number>()
  for (const t of list) if (t.type === type) { const k = t.categoryName || 'Tanpa kategori'; m.set(k, (m.get(k) ?? 0) + t.amount) }
  return [...m].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

export function monthly(txs: Tx[], n: number, anchor = isoDate()) {
  const a = parseDate(anchor)
  const out: { key: string; label: string; income: number; expense: number }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() - i, 1))
    out.push({ key: toIso(x).slice(0, 7), label: MON[x.getUTCMonth()], income: 0, expense: 0 })
  }
  const idx = new Map(out.map(o => [o.key, o]))
  for (const t of txs) {
    const o = idx.get(t.date.slice(0, 7))
    if (!o) continue
    if (t.type === 'Pemasukan') o.income += t.amount
    else if (t.type === 'Pengeluaran') o.expense += t.amount
  }
  return out
}

export function lastDays(txs: Tx[], n: number, anchor = isoDate()) {
  const out: { date: string; label: string; income: number; expense: number }[] = []
  for (let i = n - 1; i >= 0; i--) { const date = addDays(anchor, -i); out.push({ date, label: DAY[parseDate(date).getUTCDay()], income: 0, expense: 0 }) }
  const idx = new Map(out.map(o => [o.date, o]))
  for (const t of txs) {
    const o = idx.get(t.date)
    if (!o) continue
    if (t.type === 'Pemasukan') o.income += t.amount
    else if (t.type === 'Pengeluaran') o.expense += t.amount
  }
  return out
}

export function dayMap(list: Tx[]) {
  const m: Record<string, { income: number; expense: number; count: number }> = {}
  for (const t of list) {
    const g = m[t.date] ?? (m[t.date] = { income: 0, expense: 0, count: 0 })
    g.count++
    if (t.type === 'Pemasukan') g.income += t.amount
    else if (t.type === 'Pengeluaran') g.expense += t.amount
  }
  return m
}
