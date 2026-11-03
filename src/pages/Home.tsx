import { useMemo, useState } from 'react'
import { ChevronDown, LayoutGrid, Search } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { useStore } from '../store'
import { go } from '../router'
import { alive, balances, filterTx, lastDays, noFilter, totals } from '../lib/calc'
import { range } from '../lib/period'
import { num, rp } from '../lib/format'
import { Empty, Page, PeriodBar, PeriodNav, Sheet, SyncBadge, TxRow, cx } from '../ui'
import { TxDetail } from './TxDetail'
import type { Tx } from '../types'

export default function Home() {
  const { data, period, setPeriod, scope, setScope, pending, state, lastSync } = useStore()
  const [pick, setPick] = useState(false)
  const [sel, setSel] = useState<Tx | null>(null)
  const rg = range(period)
  const accs = alive(data.accounts)
  const acc = accs.find(a => a.id === scope)
  const sc = acc ? scope : 'all'
  const bal = useMemo(() => balances(data), [data])
  const tot = useMemo(() => totals(data, rg.from, rg.to, sc), [data, rg.from, rg.to, sc])
  const scoped = useMemo(() => alive(data.transactions).filter(t => sc === 'all' || t.accountId === sc || t.toAccountId === sc), [data, sc])
  const days = useMemo(() => lastDays(scoped, 7), [scoped])
  const recent = useMemo(() => filterTx(scoped, { ...noFilter, from: rg.from, to: rg.to }).slice(0, 5), [scoped, rg.from, rg.to])
  const saldo = sc === 'all' ? bal.total : (bal.accounts[sc] ?? 0)
  const loading = state === 'syncing' && !lastSync

  return (
    <Page pad="pb-56">
      <div className="safe-t bg-primary px-4 pb-14 pt-3 text-white">
        <div className="flex h-11 items-center justify-between">
          <h1 className="text-xl font-bold">MyFinance</h1>
          <div className="flex gap-1">
            <SyncBadge />
            <button className="ib" aria-label="Cari transaksi" onClick={() => go('/transaksi')}><Search size={24} /></button>
            <button className="ib" aria-label="Menu lainnya" onClick={() => go('/lainnya')}><LayoutGrid size={24} /></button>
          </div>
        </div>
        <button className="mt-2 flex items-center gap-1 text-lg font-semibold" aria-label="Pilih akun" onClick={() => setPick(true)}>
          {acc ? `Saldo ${acc.name}` : 'Saldo keseluruhan'}<ChevronDown size={20} />
        </button>
        <div className="text-4xl font-extrabold leading-tight tracking-tight" data-testid="saldo">{rp(saldo)}</div>
      </div>

      <div className="card relative mx-4 -mt-11 p-4">
        <div className="flex items-center justify-between gap-2">
          <PeriodNav value={period} onChange={setPeriod} />
          <span className="lbl text-right">Saldo sebelumnya<br /><b className="text-ink" data-testid="saldo-awal">{rp(tot.opening)}</b></span>
        </div>
        <div className="mt-3 flex gap-3">
          <div className="flex-1">
            <p className="lbl">Pemasukan</p>
            <p className="mt-1 text-xl font-extrabold text-income" data-testid="pemasukan">Rp {num(tot.income)}</p>
          </div>
          <div className="w-px self-stretch bg-line" />
          <div className="flex-1">
            <p className="lbl">Pengeluaran</p>
            <p className="mt-1 text-xl font-extrabold text-expense" data-testid="pengeluaran">Rp {num(tot.expense)}</p>
          </div>
        </div>
      </div>

      <div className="pt-4"><PeriodBar value={period} onChange={setPeriod} /></div>

      <div className="card mx-4 mt-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold">7 hari terakhir</h2>
          <span className="lbl flex gap-3 !text-xs"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-income" />Masuk</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-expense" />Keluar</span></span>
        </div>
        <div role="img" aria-label="Grafik pemasukan dan pengeluaran 7 hari terakhir" className="mt-2 h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={days} barGap={3}>
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#66707B' }} />
              <Tooltip formatter={(v: unknown) => rp(Number(v))} cursor={{ fill: '#F4F6F9' }} />
              <Bar dataKey="income" name="Masuk" fill="#22A06B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Keluar" fill="#E5484D" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between pl-5 pr-1">
        <h2 className="text-[17px] font-bold">Terbaru</h2>
        <button className="h-11 px-4 text-sm font-bold text-primary-ink" onClick={() => go('/transaksi')}>Lihat semua</button>
      </div>
      <div className="card mx-4 divide-y divide-line overflow-hidden">
        {loading ? <Empty title="Memuat data dari Google Sheets…" />
          : accs.length === 0 ? <Empty title="Belum ada akun" hint="Buat akun (mis. Cash atau BCA) agar bisa mencatat transaksi." action={<button className="btn-s bg-primary-ink" onClick={() => go('/akun')}>Tambah akun</button>} />
          : recent.length === 0 ? <Empty title="Belum ada transaksi di periode ini" hint="Ketuk tombol hijau atau merah di bawah untuk mencatat." />
          : recent.map(t => <TxRow key={t.id} tx={t} pending={pending.has(t.id)} onClick={() => setSel(t)} />)}
      </div>

      <div className="above-nav no-print fixed inset-x-0 z-20 mx-auto flex max-w-md gap-3 border-t border-line bg-surface px-4 py-3">
        <button className="btn flex-1 bg-income" onClick={() => go('/tx/baru?jenis=Pemasukan')}>Kamu Menerima</button>
        <button className="btn flex-1 bg-expense" onClick={() => go('/tx/baru?jenis=Pengeluaran')}>Kamu Membayar</button>
      </div>

      <Sheet open={pick} title="Tampilkan saldo untuk" onClose={() => setPick(false)}>
        <div className="divide-y divide-line">
          {[{ id: 'all', name: 'Semua akun', v: bal.total }, ...accs.map(a => ({ id: a.id, name: a.name, v: bal.accounts[a.id] ?? 0 }))].map(o => (
            <button key={o.id} className={cx('flex min-h-14 w-full items-center justify-between py-2 text-left', sc === o.id && 'font-bold text-primary-ink')} onClick={() => { setScope(o.id); setPick(false) }}>
              <span>{o.name}</span><span className="font-semibold">{rp(o.v)}</span>
            </button>
          ))}
        </div>
      </Sheet>
      <TxDetail tx={sel} onClose={() => setSel(null)} />
    </Page>
  )
}
