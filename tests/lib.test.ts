import assert from 'node:assert/strict'
import type { Account, Data, Queued, Tx } from '../src/types'
import { addDays, group, parseAmount, rp, validDate, validTime } from '../src/lib/format'
import { newPeriod, range, shift } from '../src/lib/period'
import { balances, byCategory, filterTx, groupByDate, lastDays, monthly, noFilter, totals } from '../src/lib/calc'
import { applyOp, toRequest, viewOf } from '../src/lib/ops'
import { parseBackup, toCsv } from '../src/lib/csv'

let n = 0
const t = (name: string, fn: () => void) => { fn(); n++; console.log('  ok', name) }
const now = '2026-11-01T00:00:00.000Z'
const acc = (id: string, name: string, openingBalance: number): Account => ({ id, name, openingBalance, status: 'Aktif', createdAt: now, updatedAt: now })
let seq = 0
const tx = (o: Partial<Tx>): Tx => ({ id: 't' + ++seq, date: '2026-11-01', time: '10:00', type: 'Pengeluaran', accountId: 'a1', accountName: 'Cash', toAccountId: '', toAccountName: '', categoryId: 'c1', categoryName: 'Makanan', amount: 0, note: '', attachment: '', items: [], status: 'Aktif', createdAt: now + seq, updatedAt: now, deletedAt: '', ...o })
const data: Data = {
  accounts: [acc('a1', 'Cash', 500000), acc('a2', 'BCA', 2050000)],
  categories: [],
  notes: [],
  transactions: [
    tx({ date: '2026-10-30', amount: 50000, note: 'Parkir' }),
    tx({ date: '2026-11-01', type: 'Pemasukan', accountId: 'a2', accountName: 'BCA', categoryName: 'Gaji', amount: 5000000, note: 'Gaji November' }),
    tx({ date: '2026-11-01', amount: 50000, categoryName: 'Transportasi', note: 'Bensin' }),
    tx({ date: '2026-11-02', amount: 25000, note: 'Makan siang' }),
    tx({ date: '2026-11-02', time: '12:00', type: 'Transfer', toAccountId: 'a2', toAccountName: 'BCA', categoryName: '', amount: 100000, note: 'Setor' }),
    tx({ date: '2026-11-02', amount: 999, status: 'Dihapus', note: 'Terhapus' })
  ]
}

console.log('format & periode')
t('rupiah dan input angka', () => { assert.equal(rp(15000), 'Rp 15.000'); assert.equal(rp(-2500), '-Rp 2.500'); assert.equal(group('1500000'), '1.500.000'); assert.equal(parseAmount('Rp 15.000'), 15000); assert.equal(parseAmount(''), 0) })
t('tanggal dan waktu valid', () => { assert.ok(validDate('2026-02-28')); assert.ok(!validDate('2026-02-30')); assert.ok(!validDate('26-1-1')); assert.ok(validTime('23:59')); assert.ok(!validTime('24:00')); assert.equal(addDays('2026-11-30', 1), '2026-12-01') })
t('rentang bulan/pekan/tahun', () => {
  assert.deepEqual(range(newPeriod('month', '2026-11-15')), { from: '2026-11-01', to: '2026-11-30', label: '1–30 Nov 2026' })
  assert.equal(range(newPeriod('month', '2028-02-10')).to, '2028-02-29')
  const w = range(newPeriod('week', '2026-11-04')); assert.equal(w.from, '2026-11-02'); assert.equal(w.to, '2026-11-08')
  assert.equal(range(newPeriod('year', '2026-06-01')).from, '2026-01-01')
  assert.equal(range(newPeriod('all')).from, null)
})
t('pindah periode', () => { assert.equal(shift(newPeriod('month', '2026-11-15'), 1).anchor, '2026-12-01'); assert.equal(shift(newPeriod('month', '2026-01-10'), -1).anchor, '2025-12-01'); assert.equal(shift(newPeriod('week', '2026-11-02'), -1).anchor, '2026-10-26'); assert.equal(shift(newPeriod('today', '2026-03-01'), -1).anchor, '2026-02-28') })

console.log('saldo & ringkasan')
t('saldo akun konsisten, transfer netral', () => {
  const b = balances(data)
  assert.equal(b.accounts.a1, 275000); assert.equal(b.accounts.a2, 7150000)
  assert.equal(b.income, 5000000); assert.equal(b.expense, 125000)   // transfer tidak dihitung
  assert.equal(b.total, 7425000); assert.equal(b.total, 2550000 + b.income - b.expense)
})
t('ringkasan bulan: saldo sebelumnya & akhir', () => {
  const x = totals(data, '2026-11-01', '2026-11-30')
  assert.deepEqual(x, { income: 5000000, expense: 75000, transfer: 0, opening: 2500000, closing: 7425000 })
  assert.equal(totals(data, null, null).closing, balances(data).total)
})
t('ringkasan per akun mencakup transfer', () => {
  const cash = totals(data, '2026-11-01', '2026-11-30', 'a1'); assert.equal(cash.opening, 450000); assert.equal(cash.transfer, -100000); assert.equal(cash.closing, 275000)
  const bca = totals(data, '2026-11-01', '2026-11-30', 'a2'); assert.equal(bca.transfer, 100000); assert.equal(bca.closing, 7150000)
})
t('akun dihapus tidak ikut dihitung', () => {
  const d2: Data = { ...data, accounts: data.accounts.map(a => (a.id === 'a2' ? { ...a, status: 'Dihapus' as const } : a)) }
  assert.equal(balances(d2).total, 275000)
})

console.log('filter & grafik')
t('cari teks dan nominal', () => {
  const act = data.transactions.filter(x => x.status === 'Aktif')
  assert.equal(filterTx(act, { ...noFilter, q: 'bensin' }).length, 1)
  assert.equal(filterTx(act, { ...noFilter, q: '25.000' }).length, 1)
  assert.equal(filterTx(act, { ...noFilter, type: 'Transfer' }).length, 1)
  assert.equal(filterTx(act, { ...noFilter, accountId: 'a2' }).length, 2)   // pemasukan BCA + transfer masuk
  assert.equal(filterTx(act, { ...noFilter, from: '2026-11-01', to: '2026-11-01' }).length, 2)
})
t('urutan terbaru/terlama', () => {
  const act = data.transactions.filter(x => x.status === 'Aktif')
  assert.equal(filterTx(act, noFilter)[0].note, 'Setor'); assert.equal(filterTx(act, { ...noFilter, sort: 'old' })[0].note, 'Parkir')
})
t('kelompok harian, kategori, bulanan, 7 hari', () => {
  const act = data.transactions.filter(x => x.status === 'Aktif')
  const g = groupByDate(filterTx(act, noFilter)); assert.deepEqual(g.map(x => x.date), ['2026-11-02', '2026-11-01', '2026-10-30']); assert.equal(g[0].expense, 25000)
  assert.deepEqual(byCategory(act, 'Pengeluaran')[0], { name: 'Makanan', value: 75000 })
  const m = monthly(act, 3, '2026-11-20'); assert.deepEqual(m.map(x => x.label), ['Sep', 'Okt', 'Nov']); assert.equal(m[2].income, 5000000); assert.equal(m[1].expense, 50000)
  const d7 = lastDays(act, 7, '2026-11-02'); assert.equal(d7.length, 7); assert.equal(d7[6].expense, 25000); assert.equal(d7[6].label, 'Sen')
})

console.log('antrean sinkron (operasi)')
t('simpan transaksi idempoten & tampilan optimistis', () => {
  const nt = tx({ id: 'new1', amount: 15000, note: 'Kopi' })
  const q: Queued[] = [{ opId: 'o1', at: now, op: { kind: 'tx.save', tx: nt, isNew: true } }, { opId: 'o2', at: now, op: { kind: 'tx.save', tx: nt, isNew: true } }]
  assert.equal(viewOf(data, q).transactions.filter(x => x.id === 'new1').length, 1)
  assert.equal(viewOf(data, [{ ...q[0], failed: true }]).transactions.length, data.transactions.length)
})
t('hapus & pulihkan & purge', () => {
  const id = data.transactions[2].id
  const del = applyOp(data, { kind: 'tx.delete', id, at: now }); assert.equal(balances(del).expense, 75000)
  const res = applyOp(del, { kind: 'tx.restore', id }); assert.equal(balances(res).expense, 125000)
  assert.equal(applyOp(del, { kind: 'tx.purge', id }).transactions.some(x => x.id === id), false)
})
t('ganti nama akun/kategori ikut memperbarui riwayat', () => {
  const r = applyOp(data, { kind: 'acc.save', isNew: false, acc: { ...data.accounts[1], name: 'BCA Utama' } })
  assert.ok(r.transactions.filter(x => x.accountId === 'a2' || x.toAccountId === 'a2').every(x => (x.accountId === 'a2' ? x.accountName : x.toAccountName) === 'BCA Utama'))
})
t('permintaan API', () => {
  assert.equal(toRequest({ kind: 'tx.save', tx: data.transactions[0], isNew: true }).action, 'tx.create')
  assert.equal(toRequest({ kind: 'tx.save', tx: data.transactions[0], isNew: false }).action, 'tx.update')
  assert.deepEqual(toRequest({ kind: 'tx.purge', id: 'x' }), { action: 'tx.purge', payload: { id: 'x' } })
})

console.log('CSV & backup')
t('CSV aman untuk tanda kutip dan titik koma', () => { assert.equal(toCsv([['a', 'b;c', 'd"e']]), '\uFEFFa;"b;c";"d""e"') })
t('validasi file backup', () => {
  assert.equal(parseBackup('bukan json').ok, false)
  assert.equal(parseBackup('{"format":"lain"}').ok, false)
  assert.equal(parseBackup(JSON.stringify({ format: 'myfinance-backup', version: 1, data: { accounts: [], categories: [], transactions: [] } })).ok, false)
  assert.equal(parseBackup(JSON.stringify({ format: 'myfinance-backup', version: 1, data: { accounts: [], categories: [], transactions: [], notes: [] } })).ok, true)
})
console.log(`\n${n} pengujian lolos`)
