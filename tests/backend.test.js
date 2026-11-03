import assert from 'node:assert/strict'
import vm from 'node:vm'
import { harness } from './gas-harness.js'

let n = 0
const t = (name, fn) => { fn(); n++; console.log('  ok', name) }
const ok = r => { assert.equal(r.ok, true, JSON.stringify(r)); return r.data }
const fail = (r, code, re) => { assert.equal(r.ok, false, 'seharusnya ditolak: ' + JSON.stringify(r)); assert.equal(r.error.code, code, JSON.stringify(r)); if (re) assert.match(r.error.message, re) }
const rows = (h, name) => h.sheet(name).getLastRow() - 1

console.log('persiapan & keamanan')
const h = harness()
t('sebelum setup semua permintaan ditolak', () => fail(h.api('bootstrap', {}, 'apa-saja'), 'not_setup'))
const key = h.setup()
t('setup membuat 4 sheet, kategori awal, akun Cash, dan kunci 40 karakter', () => {
  assert.equal(key.length, 40)
  for (const s of ['Transaksi', 'Akun', 'Kategori', 'Catatan']) assert.ok(h.sheet(s), s)
  const b = ok(h.api('bootstrap'))
  assert.equal(b.categories.length, 13); assert.deepEqual(b.accounts.map(a => a.name), ['Cash'])
  assert.deepEqual(h.sheet('Transaksi').rows[0], h.headers('tx'))
  assert.equal(h.sheet('Transaksi').fmt[2], '@'); assert.equal(h.sheet('Transaksi').fmt[11], '#,##0')
})
t('setup aman diulang (tidak menggandakan data, kunci tetap)', () => {
  h.ctx.setupMyFinance(); assert.equal(h.props.get('ACCESS_KEY'), key)
  const b = ok(h.api('bootstrap')); assert.equal(b.categories.length, 13); assert.equal(b.accounts.length, 1)
})
t('kunci salah / kosong / aksi asing / JSON rusak ditolak', () => {
  fail(h.api('bootstrap', {}, 'salah'), 'unauthorized'); fail(h.api('bootstrap', {}, ''), 'unauthorized'); fail(h.api('bootstrap', {}, null), 'unauthorized')
  fail(h.api('hapus.semua'), 'bad_request'); fail(h.api('constructor'), 'bad_request')
  assert.equal(h.raw('{rusak').ok, false)
})
t('doGet hanya memberi info publik tanpa data', () => { const r = JSON.parse(h.ctx.doGet().getContent()); assert.deepEqual(Object.keys(r.data), ['app', 'version']) })

console.log('transaksi')
const B = () => ok(h.api('bootstrap'))
const cash = B().accounts[0]
const cat = (kind, name) => B().categories.find(c => c.kind === kind && c.name === name)
ok(h.api('acc.create', { id: 'acc_bca_000001', name: 'BCA', openingBalance: 1000000 }))
const makan = cat('Pengeluaran', 'Makanan'), gaji = cat('Pemasukan', 'Gaji')
const base = { id: 'tx_0000000001', type: 'Pengeluaran', date: '2026-11-02', time: '12:10', accountId: cash.id, categoryId: makan.id, amount: 15000, note: 'Makan siang' }
t('simpan transaksi + idempoten (kirim dua kali = satu baris)', () => {
  const a = ok(h.api('tx.create', base)); assert.equal(a.duplicate, false); assert.equal(a.record.accountName, 'Cash'); assert.equal(a.record.categoryName, 'Makanan')
  const b = ok(h.api('tx.create', base)); assert.equal(b.duplicate, true)
  assert.equal(rows(h, 'Transaksi'), 1)
})
t('validasi menolak data buruk dan tidak menulis apa pun', () => {
  const bad = [{ amount: 0 }, { amount: -5 }, { amount: 1.5 }, { amount: '100' }, { amount: 1e13 }, { date: '2026-02-30' }, { date: '02-11-2026' }, { time: '25:00' },
    { accountId: 'acc_tidak_ada' }, { categoryId: gaji.id }, { type: 'Hibah' }, { id: 'x' }, { note: 'a'.repeat(501) }, { items: [{ name: '', qty: 1, price: 1 }] }, { attachment: 'javascript:alert(1)' }]
  bad.forEach((o, i) => fail(h.api('tx.create', { ...base, id: 'tx_bad_' + String(i).padStart(6, '0'), ...o }), 'bad_request'))
  fail(h.api('tx.create', { ...base, id: 'tx_tf_000001', type: 'Transfer', toAccountId: cash.id }), 'bad_request', /tidak boleh sama/)
  fail(h.api('tx.create', { ...base, id: 'tx_tf_000002', type: 'Transfer', toAccountId: '' }), 'bad_request')
  assert.equal(rows(h, 'Transaksi'), 1)
})
t('pemasukan, transfer, rincian barang; transfer tidak masuk pemasukan/pengeluaran', () => {
  ok(h.api('tx.create', { id: 'tx_0000000002', type: 'Pemasukan', date: '2026-11-01', time: '08:00', accountId: 'acc_bca_000001', categoryId: gaji.id, amount: 5000000, note: 'Gaji' }))
  ok(h.api('tx.create', { id: 'tx_0000000003', type: 'Transfer', date: '2026-11-02', time: '13:00', accountId: cash.id, toAccountId: 'acc_bca_000001', amount: 100000 }))
  ok(h.api('tx.create', { ...base, id: 'tx_0000000004', amount: 30000, items: [{ name: 'Nasi', qty: 2, unit: 'porsi', price: 15000 }] }))
  const b = B()
  assert.equal(b.balances.accounts[cash.id], 0 - 15000 - 100000 - 30000)
  assert.equal(b.balances.accounts['acc_bca_000001'], 1000000 + 5000000 + 100000)
  assert.equal(b.balances.income, 5000000); assert.equal(b.balances.expense, 45000); assert.equal(b.balances.total, 6000000 - 45000)
  assert.deepEqual(b.transactions.find(x => x.id === 'tx_0000000004').items, [{ name: 'Nasi', qty: 2, unit: 'porsi', price: 15000 }])
  assert.equal(b.transactions.find(x => x.id === 'tx_0000000003').toAccountName, 'BCA')
})
t('ubah transaksi memperbarui saldo; transaksi di sampah tidak bisa diubah', () => {
  const r = ok(h.api('tx.update', { ...base, amount: 20000, note: 'Revisi' })); assert.equal(r.record.amount, 20000)
  assert.equal(B().balances.accounts[cash.id], -20000 - 100000 - 30000)
  fail(h.api('tx.update', { ...base, id: 'tx_tidak_ada_1' }), 'not_found')
})
t('hapus = soft delete; idempoten; pulihkan; purge hanya dari sampah', () => {
  const before = rows(h, 'Transaksi')
  const d = ok(h.api('tx.delete', { id: base.id })); assert.equal(d.record.status, 'Dihapus'); assert.ok(d.record.deletedAt)
  ok(h.api('tx.delete', { id: base.id })); assert.equal(rows(h, 'Transaksi'), before)
  assert.equal(B().balances.expense, 30000)
  fail(h.api('tx.update', base), 'conflict')
  fail(h.api('tx.purge', { id: 'tx_0000000002' }), 'conflict')
  assert.equal(ok(h.api('tx.restore', { id: base.id })).record.status, 'Aktif'); assert.equal(B().balances.expense, 50000)
  ok(h.api('tx.delete', { id: base.id })); assert.equal(ok(h.api('tx.purge', { id: base.id })).removed, true)
  assert.equal(rows(h, 'Transaksi'), before - 1); assert.equal(ok(h.api('tx.purge', { id: base.id })).removed, false)
})
t('penulisan memakai kunci; bila kunci sibuk ditolak tanpa menulis', () => {
  const a0 = h.lock.acquired, r0 = h.lock.released
  ok(h.api('tx.create', { ...base, id: 'tx_0000000009', amount: 1000 }))
  B(); assert.equal(h.lock.acquired, a0 + 1); assert.equal(h.lock.released, r0 + 1)   // baca tidak mengunci
  h.lock.busy = true; const cnt = rows(h, 'Transaksi')
  fail(h.api('tx.create', { ...base, id: 'tx_0000000010' }), 'busy'); assert.equal(rows(h, 'Transaksi'), cnt)
  h.lock.busy = false
  ok(h.api('tx.delete', { id: 'tx_0000000009' })); ok(h.api('tx.purge', { id: 'tx_0000000009' }))
})

console.log('akun, kategori, catatan')
t('ganti nama akun memperbarui riwayat; akun terpakai tidak bisa dihapus', () => {
  ok(h.api('acc.update', { id: 'acc_bca_000001', name: 'BCA Utama', openingBalance: 1000000 }))
  const sh = h.sheet('Transaksi'), hd = h.headers('tx'), col = x => hd.indexOf(x) + 1
  const names = sh.getRange(2, col('Akun'), rows(h, 'Transaksi'), 1).getValues().flat()
  const tos = sh.getRange(2, col('Akun Tujuan'), rows(h, 'Transaksi'), 1).getValues().flat()
  assert.ok(names.includes('BCA Utama')); assert.ok(tos.includes('BCA Utama')); assert.ok(!tos.includes('BCA'))
  fail(h.api('acc.delete', { id: 'acc_bca_000001' }), 'conflict', /masih dipakai/)
  fail(h.api('acc.create', { id: 'acc_dup_000001', name: 'bca utama' }), 'bad_request', /sudah dipakai/)
  ok(h.api('acc.create', { id: 'acc_tmp_000001', name: 'Sementara' })); assert.equal(ok(h.api('acc.delete', { id: 'acc_tmp_000001' })).record.status, 'Dihapus')
  fail(h.api('tx.create', { ...base, id: 'tx_0000000011', accountId: 'acc_tmp_000001' }), 'bad_request')
})
t('kategori: duplikat ditolak, ganti nama memperbarui riwayat, jenis tak bisa diubah', () => {
  fail(h.api('cat.create', { id: 'cat_dup_000001', name: 'makanan', kind: 'Pengeluaran' }), 'bad_request')
  ok(h.api('cat.create', { id: 'cat_baru_00001', name: 'Makanan', kind: 'Pemasukan' }))   // nama sama tapi jenis beda: boleh
  ok(h.api('cat.update', { id: makan.id, name: 'Makan & Minum', kind: 'Pengeluaran' }))
  const sh = h.sheet('Transaksi'), c = h.headers('tx').indexOf('Kategori') + 1
  assert.ok(sh.getRange(2, c, rows(h, 'Transaksi'), 1).getValues().flat().includes('Makan & Minum'))
  fail(h.api('cat.update', { id: makan.id, name: 'X', kind: 'Pemasukan' }), 'bad_request', /tidak bisa diubah/)
  assert.equal(ok(h.api('cat.delete', { id: 'cat_baru_00001' })).record.status, 'Dihapus')
})
t('catatan: tambah, selesai, hapus, validasi', () => {
  const nn = { id: 'note_00000001', date: '2026-11-02', time: '00:00', title: 'Bayar listrik', body: '', done: false }
  ok(h.api('note.create', nn)); ok(h.api('note.update', { ...nn, done: true }))
  assert.equal(B().notes[0].done, true)
  fail(h.api('note.create', { ...nn, id: 'note_00000002', title: '', body: '' }), 'bad_request')
  assert.equal(ok(h.api('note.delete', { id: nn.id })).record.status, 'Dihapus')
})

console.log('backup, restore, lampiran')
const mkBackup = d => ({ format: 'myfinance-backup', version: 1, exportedAt: 'x', data: { accounts: d.accounts, categories: d.categories, transactions: d.transactions, notes: d.notes } })
t('restore: uji coba tidak menulis; gabung hanya menambah, tidak menimpa; ada salinan pengaman', () => {
  const snap = B(), bk = mkBackup(snap)
  const dry = ok(h.api('restore.apply', { backup: bk, dryRun: true })); assert.equal(dry.applied, false); assert.equal(dry.counts.transactions, 0); assert.ok(dry.counts.skipped > 0)
  const bk2 = mkBackup(JSON.parse(JSON.stringify(snap)))
  bk2.data.accounts.push({ id: 'acc_bri_000001', name: 'BRI', openingBalance: 500, status: 'Aktif', createdAt: 'a', updatedAt: 'a' })
  bk2.data.transactions[0].amount = 777                      // data lama diubah di file: harus DIABAIKAN
  bk2.data.transactions.push({ ...snap.transactions[0], id: 'tx_restore_001', accountId: 'acc_bri_000001', accountName: 'BRI', amount: 4200 })
  const before = rows(h, 'Transaksi'), copies = h.drive.copies.length
  assert.equal(ok(h.api('restore.apply', { backup: bk2, dryRun: true })).counts.transactions, 1); assert.equal(rows(h, 'Transaksi'), before)
  const r = ok(h.api('restore.apply', { backup: bk2 })); assert.equal(r.applied, true); assert.deepEqual([r.counts.accounts, r.counts.transactions], [1, 1])
  assert.equal(rows(h, 'Transaksi'), before + 1); assert.equal(h.drive.copies.length, copies + 1)
  const after = B(); assert.equal(after.transactions.find(x => x.id === snap.transactions[0].id).amount, snap.transactions[0].amount)
  assert.equal(after.balances.accounts['acc_bri_000001'], 500 + 4200)   // transaksi kloning adalah pemasukan
})
t('restore: file rusak/tidak valid dibatalkan seluruhnya', () => {
  const snap = B(), before = rows(h, 'Transaksi'), copies = h.drive.copies.length
  fail(h.api('restore.apply', { backup: { format: 'lain' } }), 'bad_request')
  const bk = mkBackup(snap); bk.data.transactions.push({ ...snap.transactions[0], id: 'tx_restore_bad', amount: -5 }, { ...snap.transactions[0], id: 'tx_restore_bad2', accountId: 'acc_hantu' })
  const r = ok(h.api('restore.apply', { backup: bk })); assert.equal(r.applied, false); assert.equal(r.errorCount, 2)
  assert.equal(rows(h, 'Transaksi'), before); assert.equal(h.drive.copies.length, copies)
})
t('backup manual menyimpan maksimal 8 salinan terbaru', () => {
  for (let i = 0; i < 10; i++) ok(h.api('backup.now'))
  let c = 0; const it = h.drive.folders.get('MyFinance Backup').getFiles(); while (it.hasNext()) { it.next(); c++ }
  assert.equal(c, 8)
})
t('backup otomatis mingguan dipasang sekali saja', () => { h.ctx.installBackupTrigger(); h.ctx.installBackupTrigger(); assert.equal(h.triggers.length, 1) })
t('unggah lampiran: tipe & ukuran dibatasi', () => {
  const r = ok(h.api('file.upload', { name: 'nota struk.pdf', mime: 'application/pdf', data: Buffer.from('%PDF-1').toString('base64') })); assert.match(r.url, /^https:\/\/drive\.google\.com/)
  fail(h.api('file.upload', { name: 'x.exe', mime: 'application/x-msdownload', data: 'AAAA' }), 'bad_request')
  fail(h.api('file.upload', { name: 'big.pdf', mime: 'application/pdf', data: 'A'.repeat(6000000) }), 'bad_request', /terlalu besar/)
})

console.log('data lama Anda tidak disentuh')
t('sheet lama dengan kolom berbeda: berhenti dengan pesan jelas, isi tidak berubah', () => {
  const g = harness()
  const old = g.ss.insertSheet('Transaksi'); old.set(1, 1, 'Tanggal'); old.set(1, 2, 'Jumlah'); old.set(2, 1, '1 Jan'); old.set(2, 2, 5000)
  const own = g.ss.insertSheet('Sheet1'); own.set(1, 1, 'catatan pribadi')
  const snapshot = JSON.stringify([old.rows, own.rows])
  assert.throws(() => g.ctx.setupMyFinance(), /kolomnya berbeda/)
  assert.equal(JSON.stringify([old.rows, own.rows]), snapshot)
})
t('awalan PREFIX menghindari bentrok nama sheet', () => {
  const g = harness(); const old = g.ss.insertSheet('Transaksi'); old.set(1, 1, 'Tanggal'); old.set(2, 1, 'data lama')
  vm.runInContext('CFG.PREFIX = "MF_"', g.ctx); g.setup()
  assert.ok(g.sheet('MF_Transaksi')); assert.equal(old.get(2, 1), 'data lama')
})
t('sheet buatan sendiri dengan judul cocok (tanpa format teks) tetap bekerja', () => {
  const g = harness(); const sh = g.ss.insertSheet('Transaksi'); g.headers('tx').forEach((x, i) => sh.set(1, i + 1, x))
  const k = g.setup(); assert.ok(k)
  const b = ok(g.api('bootstrap')), ac = b.accounts[0], ct = b.categories.find(c => c.kind === 'Pengeluaran')
  ok(g.api('tx.create', { id: 'tx_lama_000001', type: 'Pengeluaran', date: '2026-11-02', time: '09:05', accountId: ac.id, categoryId: ct.id, amount: 5000 }))
  const tx = ok(g.api('bootstrap')).transactions[0]; assert.equal(tx.date, '2026-11-02'); assert.equal(tx.time, '09:05')
})
console.log(`\n${n} pengujian backend lolos`)
