import { useEffect, useRef, useState } from 'react'
import { Calendar, Camera, Clock, List, Mic, X } from 'lucide-react'
import { useStore } from '../store'
import { back, go } from '../router'
import { alive } from '../lib/calc'
import { group, hhmm, isoDate, num, parseAmount, validDate, validTime } from '../lib/format'
import { uid } from '../lib/id'
import { prepareUpload } from '../lib/image'
import { Empty, MoneyInput, Page, Seg, Sheet, TopBar, cx } from '../ui'
import type { Item, Tx } from '../types'

const ls = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* abaikan */ } }

interface Recognition { lang: string; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; start: () => void }

export default function TxForm({ id, q }: { id?: string; q: URLSearchParams }) {
  const { data, state } = useStore()
  const editing = id ? data.transactions.find(t => t.id === id && t.status === 'Aktif') : undefined
  if (id && (!editing || editing.type === 'Transfer')) {
    return <Page><TopBar title="Ubah transaksi" onBack={() => back('/')} /><Empty title={state === 'syncing' ? 'Memuat…' : 'Transaksi tidak ditemukan'} hint="Transfer diubah lewat menu Transfer." /></Page>
  }
  return <Inner editing={editing} q={q} />
}

function Inner({ editing, q }: { editing?: Tx; q: URLSearchParams }) {
  const { data, submit, call, toast } = useStore()
  const accs = alive(data.accounts)
  const [txId, setTxId] = useState(() => editing?.id ?? uid('tx_'))
  const [type, setType] = useState<'Pemasukan' | 'Pengeluaran'>(editing ? (editing.type as 'Pemasukan' | 'Pengeluaran') : q.get('jenis') === 'Pemasukan' ? 'Pemasukan' : 'Pengeluaran')
  const [amount, setAmount] = useState(editing ? group(String(editing.amount)) : '')
  const [accountId, setAccountId] = useState(editing?.accountId ?? '')
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? '')
  const [date, setDate] = useState(editing?.date ?? isoDate())
  const [time, setTime] = useState(editing?.time ?? hhmm())
  const [note, setNote] = useState(editing?.note ?? '')
  const [items, setItems] = useState<Item[]>(editing?.items ?? [])
  const [attachment, setAttachment] = useState(editing?.attachment ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [itemsOpen, setItemsOpen] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cats = alive(data.categories).filter(c => c.kind === type)
  const isIn = type === 'Pemasukan'

  useEffect(() => {
    if (!accs.some(a => a.id === accountId) && accs[0]) setAccountId((accs.find(a => a.id === ls('mf.lastAcc')) ?? accs[0]).id)
  }, [accs, accountId])
  useEffect(() => {
    if (!cats.some(c => c.id === categoryId) && cats.length) setCategoryId((cats.find(c => c.id === ls('mf.cat.' + type)) ?? cats[0]).id)
  }, [cats, categoryId, type])

  const validate = () => {
    const amt = parseAmount(amount)
    if (!amt) return 'Isi nominal terlebih dahulu.'
    if (amt > 1e12) return 'Nominal terlalu besar.'
    if (!accountId) return 'Pilih akun. Tambahkan akun lebih dulu bila belum ada.'
    if (!categoryId) return 'Pilih kategori.'
    if (!validDate(date)) return 'Tanggal tidak valid.'
    if (!validTime(time)) return 'Waktu tidak valid.'
    if (note.length > 500) return 'Catatan maksimal 500 karakter.'
    return ''
  }

  const save = async (more: boolean) => {
    if (saving) return                                    // cegah klik berulang
    const e = validate()
    if (e) { setErr(e); return }
    setSaving(true); setErr('')
    try {
      let url = attachment
      if (file) url = (await call<{ url: string }>('file.upload', await prepareUpload(file))).url
      const acc = accs.find(a => a.id === accountId)!, cat = cats.find(c => c.id === categoryId)!
      const now = new Date().toISOString()
      const tx: Tx = { id: txId, date, time, type, accountId: acc.id, accountName: acc.name, toAccountId: '', toAccountName: '', categoryId: cat.id, categoryName: cat.name, amount: parseAmount(amount), note: note.trim(), attachment: url, items, status: 'Aktif', createdAt: editing?.createdAt ?? now, updatedAt: now, deletedAt: '' }
      const r = await submit({ kind: 'tx.save', tx, isNew: !editing })
      if (!r.ok) { setErr(r.error ?? 'Gagal menyimpan.'); return }
      lsSet('mf.lastAcc', acc.id); lsSet('mf.cat.' + type, cat.id)
      toast(r.queued ? 'Disimpan di HP. Akan dikirim ke Google Sheets saat online.' : 'Tersimpan di Google Sheets', r.queued ? 'warn' : 'ok')
      if (more && !editing) { setTxId(uid('tx_')); setAmount(''); setNote(''); setItems([]); setAttachment(''); setFile(null); setTime(hhmm()); amountRef.current?.focus() }
      else back('/')
    } catch (x) { setErr(x instanceof Error ? x.message : 'Gagal menyimpan.') } finally { setSaving(false) }
  }

  const listen = () => {
    const W = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
    const SR = W.SpeechRecognition ?? W.webkitSpeechRecognition
    if (!SR) { toast('Perangkat/browser ini belum mendukung catatan suara.', 'warn'); return }
    const r = new SR()
    r.lang = 'id-ID'
    r.onresult = ev => { const t = ev.results[0]?.[0]?.transcript; if (t) setNote(n => (n ? n + ' ' : '') + t) }
    r.onerror = () => toast('Catatan suara gagal. Periksa izin mikrofon.', 'warn')
    r.start()
  }

  const tone = isIn ? 'text-income' : 'text-expense'
  return (
    <Page pad="pb-56">
      <TopBar title={isIn ? 'Kamu Menerima' : 'Kamu Membayar'} onBack={() => back('/')} />
      <div className="space-y-3 px-4 pt-4">
        {!editing && <Seg value={type} options={['Pemasukan', 'Pengeluaran']} onChange={setType} tones={{ Pemasukan: 'border-income bg-income-soft font-bold text-income-ink', Pengeluaran: 'border-expense bg-expense-soft font-bold text-expense-ink' }} />}

        <div className="card px-4 pb-1 pt-3">
          <label htmlFor="nominal" className="lbl">Nominal</label>
          <div className={cx('flex items-center gap-2 border-b-2', isIn ? 'border-income' : 'border-expense')}>
            <b className="text-xl text-mute-ink">Rp</b>
            <MoneyInput id="nominal" value={amount} onChange={setAmount} tone={tone} inputRef={amountRef} />
          </div>
        </div>

        {accs.length === 0 ? (
          <div className="card p-4 text-[15px]">Belum ada akun. <button className="font-bold text-primary-ink underline" onClick={() => go('/akun')}>Tambah akun</button></div>
        ) : (
          <label className="card block px-4 py-2"><span className="lbl block !text-xs">Akun</span>
            <select className="h-9 w-full bg-transparent text-base font-bold outline-none" value={accountId} onChange={e => setAccountId(e.target.value)}>{accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        )}

        <div className="card p-4">
          <p className="lbl">Kategori</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {cats.map(c => <button key={c.id} aria-pressed={categoryId === c.id} onClick={() => setCategoryId(c.id)} className={cx('chip', categoryId === c.id && (isIn ? 'border-income bg-income-soft font-bold text-income-ink' : 'border-expense bg-expense-soft font-bold text-expense-ink'))}>{c.name}</button>)}
            <button className="chip text-primary-ink" onClick={() => go('/kategori')}>Kelola</button>
          </div>
        </div>

        <div className="flex gap-3">
          <label className="card flex flex-[3] items-center gap-2 px-4 py-2"><span className="flex-1"><span className="lbl block !text-xs">Tanggal</span><input type="date" className="h-9 w-full bg-transparent text-base font-bold outline-none" value={date} onChange={e => setDate(e.target.value)} /></span><Calendar size={20} className="text-mute-ink" aria-hidden /></label>
          <label className="card flex flex-[2] items-center gap-2 px-4 py-2"><span className="flex-1"><span className="lbl block !text-xs">Waktu</span><input type="time" className="h-9 w-full bg-transparent text-base font-bold outline-none" value={time} onChange={e => setTime(e.target.value.slice(0, 5))} /></span><Clock size={20} className="text-mute-ink" aria-hidden /></label>
        </div>

        <div className="card flex items-center pl-4 pr-1">
          <input aria-label="Catatan" maxLength={500} className="h-14 min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-mute" placeholder="Catatan (opsional)" value={note} onChange={e => setNote(e.target.value)} />
          <button className="ib" aria-label="Catatan suara" onClick={listen}><Mic size={22} /></button>
        </div>

        <div className="flex gap-3">
          <button className="chip flex flex-1 items-center justify-center gap-2 !border-dashed" onClick={() => fileRef.current?.click()}><Camera size={20} />Lampiran</button>
          <button className="chip flex flex-1 items-center justify-center gap-2 !border-dashed" onClick={() => setItemsOpen(true)}><List size={20} />Rincian barang{items.length > 0 && ` (${items.length})`}</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setAttachment('') } e.target.value = '' }} />
        {(file || attachment) && (
          <div className="card flex items-center justify-between px-4 py-2 text-[15px]">
            <span className="truncate font-semibold">{file ? file.name : 'Lampiran tersimpan'}</span>
            <button className="ib" aria-label="Hapus lampiran" onClick={() => { setFile(null); setAttachment('') }}><X size={20} /></button>
          </div>
        )}
        {err && <p role="alert" className="rounded-2xl bg-expense-soft px-4 py-3 text-[15px] font-semibold text-expense-ink">{err}</p>}
      </div>

      <div className="safe-b fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md flex-col gap-2 border-t border-line bg-surface px-4 pt-3">
        <button className="btn w-full bg-primary-ink" disabled={saving} onClick={() => save(false)}>{saving ? 'Menyimpan…' : 'Simpan dan keluar'}</button>
        {!editing && <button className="btn-ghost w-full" disabled={saving} onClick={() => save(true)}>Simpan dan lanjutkan</button>}
      </div>

      <ItemsSheet open={itemsOpen} items={items} onClose={() => setItemsOpen(false)} onSave={list => { setItems(list); const t = list.reduce((s, i) => s + Math.round(i.qty * i.price), 0); if (t > 0) setAmount(group(String(t))); setItemsOpen(false) }} />
    </Page>
  )
}

function ItemsSheet({ open, items, onClose, onSave }: { open: boolean; items: Item[]; onClose: () => void; onSave: (l: Item[]) => void }) {
  const [list, setList] = useState<Item[]>(items)
  const [n, setN] = useState(''); const [qty, setQty] = useState('1'); const [unit, setUnit] = useState(''); const [price, setPrice] = useState('')
  useEffect(() => { if (open) setList(items) }, [open, items])
  const total = list.reduce((s, i) => s + Math.round(i.qty * i.price), 0)
  const add = () => {
    const q = Number(qty.replace(',', '.'))
    if (!n.trim() || !(q > 0) || !parseAmount(price)) return
    setList(l => [...l, { name: n.trim(), qty: q, unit: unit.trim(), price: parseAmount(price) }])
    setN(''); setQty('1'); setUnit(''); setPrice('')
  }
  return (
    <Sheet open={open} title="Rincian barang" onClose={onClose}>
      <div className="space-y-3">
        <input className="input" aria-label="Nama barang" placeholder="Nama barang" value={n} onChange={e => setN(e.target.value)} />
        <div className="flex gap-2">
          <input className="input" aria-label="Jumlah" inputMode="decimal" placeholder="Jumlah" value={qty} onChange={e => setQty(e.target.value)} />
          <input className="input" aria-label="Satuan" placeholder="Satuan" value={unit} onChange={e => setUnit(e.target.value)} />
          <input className="input" aria-label="Harga satuan" inputMode="numeric" placeholder="Harga" value={price} onChange={e => setPrice(group(e.target.value))} />
        </div>
        <button className="btn-ghost w-full" onClick={add}>Tambahkan</button>
        <ul className="divide-y divide-line rounded-2xl bg-surface px-3">
          {list.length === 0 && <li className="py-3 text-[15px] text-mute-ink">Belum ada barang.</li>}
          {list.map((i, k) => (
            <li key={k} className="flex items-center justify-between py-2 text-[15px]">
              <span>{i.name} ({i.qty} {i.unit})</span>
              <span className="flex items-center gap-1 font-semibold">Rp {num(i.qty * i.price)}<button className="ib" aria-label={`Hapus ${i.name}`} onClick={() => setList(l => l.filter((_, j) => j !== k))}><X size={18} /></button></span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between text-base font-bold"><span>Total</span><span>Rp {num(total)}</span></p>
        <button className="btn w-full bg-primary-ink" onClick={() => onSave(list)}>Selesai</button>
      </div>
    </Sheet>
  )
}
