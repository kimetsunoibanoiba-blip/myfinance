import type { Data, Op, Queued } from '../types'

const upsert = <T extends { id: string }>(a: T[], x: T): T[] => (a.some(y => y.id === x.id) ? a.map(y => (y.id === x.id ? x : y)) : [...a, x])
const mark = <T extends { id: string; status: 'Aktif' | 'Dihapus' }>(a: T[], id: string): T[] => a.map(y => (y.id === id ? { ...y, status: 'Dihapus' as const } : y))

/** Fungsi murni: dipakai untuk tampilan optimistis (data server + antrean yang belum terkirim). */
export function applyOp(d: Data, op: Op): Data {
  switch (op.kind) {
    case 'tx.save': return { ...d, transactions: upsert(d.transactions, { ...op.tx, status: 'Aktif' }) }
    case 'tx.delete': return { ...d, transactions: d.transactions.map(t => (t.id === op.id ? { ...t, status: 'Dihapus', deletedAt: op.at } : t)) }
    case 'tx.restore': return { ...d, transactions: d.transactions.map(t => (t.id === op.id ? { ...t, status: 'Aktif', deletedAt: '' } : t)) }
    case 'tx.purge': return { ...d, transactions: d.transactions.filter(t => t.id !== op.id) }
    case 'acc.save': {
      const a = op.acc
      return { ...d, accounts: upsert(d.accounts, a), transactions: d.transactions.map(t => ({ ...t, accountName: t.accountId === a.id ? a.name : t.accountName, toAccountName: t.toAccountId === a.id ? a.name : t.toAccountName })) }
    }
    case 'acc.delete': return { ...d, accounts: mark(d.accounts, op.id) }
    case 'cat.save': {
      const c = op.cat
      return { ...d, categories: upsert(d.categories, c), transactions: d.transactions.map(t => (t.categoryId === c.id ? { ...t, categoryName: c.name } : t)) }
    }
    case 'cat.delete': return { ...d, categories: mark(d.categories, op.id) }
    case 'note.save': return { ...d, notes: upsert(d.notes, op.note) }
    case 'note.delete': return { ...d, notes: mark(d.notes, op.id) }
  }
}

export const viewOf = (server: Data, queue: Queued[]): Data => queue.filter(q => !q.failed).reduce((d, q) => applyOp(d, q.op), server)

/** Terjemahan operasi -> permintaan API (sesuai apps-script/Code.gs) */
export function toRequest(op: Op): { action: string; payload: unknown } {
  switch (op.kind) {
    case 'tx.save': {
      const t = op.tx
      return { action: op.isNew ? 'tx.create' : 'tx.update', payload: { id: t.id, type: t.type, date: t.date, time: t.time, accountId: t.accountId, toAccountId: t.toAccountId, categoryId: t.categoryId, amount: t.amount, note: t.note, attachment: t.attachment, items: t.items } }
    }
    case 'tx.delete': return { action: 'tx.delete', payload: { id: op.id } }
    case 'tx.restore': return { action: 'tx.restore', payload: { id: op.id } }
    case 'tx.purge': return { action: 'tx.purge', payload: { id: op.id } }
    case 'acc.save': return { action: op.isNew ? 'acc.create' : 'acc.update', payload: { id: op.acc.id, name: op.acc.name, openingBalance: op.acc.openingBalance } }
    case 'acc.delete': return { action: 'acc.delete', payload: { id: op.id } }
    case 'cat.save': return { action: op.isNew ? 'cat.create' : 'cat.update', payload: { id: op.cat.id, name: op.cat.name, kind: op.cat.kind } }
    case 'cat.delete': return { action: 'cat.delete', payload: { id: op.id } }
    case 'note.save': { const n = op.note; return { action: op.isNew ? 'note.create' : 'note.update', payload: { id: n.id, date: n.date, time: n.time, title: n.title, body: n.body, done: n.done } } }
    case 'note.delete': return { action: 'note.delete', payload: { id: op.id } }
  }
}
