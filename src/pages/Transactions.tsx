import { useMemo, useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { useStore } from '../store'
import { alive, filterTx, groupByDate, noFilter, type Filter } from '../lib/calc'
import { fmtDay, num } from '../lib/format'
import { Empty, Page, Sheet, TxRow, cx } from '../ui'
import { TxDetail } from './TxDetail'
import type { Tx, TxType } from '../types'

export default function Transactions() {
  const { data, pending } = useStore()
  const [f, setF] = useState<Filter>(noFilter)
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState<Tx | null>(null)
  const list = useMemo(() => filterTx(alive(data.transactions), f), [data, f])
  const groups = useMemo(() => groupByDate(list), [list])
  const accs = alive(data.accounts), cats = alive(data.categories)
  const n = [f.type, f.accountId, f.categoryId, f.from, f.to].filter(Boolean).length + (f.sort === 'old' ? 1 : 0)
  const set = (p: Partial<Filter>) => setF(x => ({ ...x, ...p }))

  return (
    <Page pad="pb-28">
      <header className="safe-t sticky top-0 z-20 bg-primary px-4 pb-3 pt-3 text-white">
        <h1 className="mb-2 text-xl font-bold">Transaksi</h1>
        <div className="flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Cari transaksi</span>
            <Search size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute-ink" />
            <input className="input !h-12 pl-10 text-ink" placeholder="Cari catatan, kategori, nominal" value={f.q} onChange={e => set({ q: e.target.value })} />
          </label>
          <button className="ib relative h-12 w-12 bg-white/20" aria-label="Filter dan urutan" onClick={() => setOpen(true)}>
            <SlidersHorizontal size={22} />
            {n > 0 && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-primary-ink">{n}</span>}
          </button>
        </div>
      </header>

      {groups.length === 0 ? <Empty title="Tidak ada transaksi" hint={n || f.q ? 'Coba ubah kata kunci atau filter.' : 'Transaksi yang Anda catat akan muncul di sini.'} /> : (
        <div className="space-y-4 px-4 pt-4">
          {groups.map(g => (
            <section key={g.date}>
              <div className="mb-1 flex items-baseline justify-between px-1">
                <h2 className="text-sm font-bold">{fmtDay(g.date)}</h2>
                <span className="lbl !text-xs">{g.income > 0 && <span className="text-income-ink">+{num(g.income)} </span>}{g.expense > 0 && <span className="text-expense-ink">−{num(g.expense)}</span>}</span>
              </div>
              <div className="card divide-y divide-line overflow-hidden">{g.items.map(t => <TxRow key={t.id} tx={t} pending={pending.has(t.id)} onClick={() => setSel(t)} />)}</div>
            </section>
          ))}
        </div>
      )}

      <Sheet open={open} title="Filter dan urutan" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div><p className="lbl mb-1">Jenis</p>
            <div className="flex flex-wrap gap-2">{(['', 'Pemasukan', 'Pengeluaran', 'Transfer'] as const).map(t => <button key={t} aria-pressed={f.type === t} className={cx('chip', f.type === t && 'chip-on')} onClick={() => set({ type: t as '' | TxType })}>{t || 'Semua'}</button>)}</div></div>
          <label className="block"><span className="lbl">Akun</span>
            <select className="input mt-1" value={f.accountId} onChange={e => set({ accountId: e.target.value })}><option value="">Semua akun</option>{accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label className="block"><span className="lbl">Kategori</span>
            <select className="input mt-1" value={f.categoryId} onChange={e => set({ categoryId: e.target.value })}><option value="">Semua kategori</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name} ({c.kind})</option>)}</select></label>
          <div className="flex gap-3">
            <label className="block flex-1"><span className="lbl">Dari tanggal</span><input type="date" className="input mt-1" value={f.from ?? ''} onChange={e => set({ from: e.target.value || null })} /></label>
            <label className="block flex-1"><span className="lbl">Sampai</span><input type="date" className="input mt-1" value={f.to ?? ''} onChange={e => set({ to: e.target.value || null })} /></label>
          </div>
          <div><p className="lbl mb-1">Urutan</p>
            <div className="flex gap-2">{([['new', 'Terbaru'], ['old', 'Terlama']] as const).map(([v, l]) => <button key={v} aria-pressed={f.sort === v} className={cx('chip flex-1', f.sort === v && 'chip-on')} onClick={() => set({ sort: v })}>{l}</button>)}</div></div>
          <div className="flex gap-3">
            <button className="btn-ghost flex-1" onClick={() => setF({ ...noFilter, q: f.q })}>Atur ulang</button>
            <button className="btn-s flex-1 bg-primary-ink" onClick={() => setOpen(false)}>Tampilkan {list.length}</button>
          </div>
        </div>
      </Sheet>
      <TxDetail tx={sel} onClose={() => setSel(null)} />
    </Page>
  )
}
