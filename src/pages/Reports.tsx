import { useMemo } from 'react'
import { Download, Printer } from 'lucide-react'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { useStore } from '../store'
import { alive, byCategory, filterTx, monthly, noFilter, totals } from '../lib/calc'
import { range } from '../lib/period'
import { rp } from '../lib/format'
import { download, toCsv, txRows } from '../lib/csv'
import { Page, PeriodBar, PeriodNav, cx } from '../ui'

const PAL = ['#1685E5', '#22A06B', '#E5484D', '#F5A524', '#8B5CF6', '#06B6D4', '#EC4899', '#64748B']

function Breakdown({ title, rows }: { title: string; rows: { name: string; value: number }[] }) {
  const sum = rows.reduce((s, r) => s + r.value, 0)
  return (
    <section className="card mx-4 mt-4 p-4">
      <h2 className="text-[15px] font-bold">{title}</h2>
      {rows.length === 0 ? <p className="mt-2 text-[15px] text-mute-ink">Belum ada data pada periode ini.</p> : (
        <>
          <div role="img" aria-label={title} className="mt-2 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={rows} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2}>
                  {rows.map((r, i) => <Cell key={r.name} fill={PAL[i % PAL.length]} />)}
                </Pie>
                <Tooltip formatter={(v: unknown) => rp(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 divide-y divide-line">
            {rows.map((r, i) => (
              <li key={r.name} className="flex min-h-11 items-center justify-between gap-2 text-[15px]">
                <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm" style={{ background: PAL[i % PAL.length] }} />{r.name}</span>
                <span className="font-semibold">{Math.round((r.value / sum) * 100)}%<span className="ml-2 text-mute-ink">{rp(r.value)}</span></span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export default function Reports() {
  const { data, period, setPeriod } = useStore()
  const rg = range(period)
  const tot = useMemo(() => totals(data, rg.from, rg.to), [data, rg.from, rg.to])
  const list = useMemo(() => filterTx(alive(data.transactions), { ...noFilter, from: rg.from, to: rg.to, sort: 'old' }), [data, rg.from, rg.to])
  const exp = useMemo(() => byCategory(list, 'Pengeluaran'), [list])
  const inc = useMemo(() => byCategory(list, 'Pemasukan'), [list])
  const mon = useMemo(() => monthly(alive(data.transactions), 6), [data])
  const diff = tot.income - tot.expense
  const stat = (label: string, v: number, tone: string, id: string) => (
    <div className="card p-4"><p className="lbl">{label}</p><p className={cx('mt-1 text-lg font-extrabold', tone)} data-testid={id}>{rp(v)}</p></div>
  )
  return (
    <Page pad="pb-28">
      <header className="safe-t bg-primary px-4 pb-4 pt-3 text-white"><h1 className="h-11 text-xl font-bold leading-[44px]">Laporan</h1></header>
      <div className="pt-3"><PeriodBar value={period} onChange={setPeriod} /></div>
      <div className="flex justify-center pt-1"><PeriodNav value={period} onChange={setPeriod} /></div>

      <div className="mx-4 mt-3 grid grid-cols-2 gap-3">
        {stat('Pemasukan', tot.income, 'text-income-ink', 'r-income')}
        {stat('Pengeluaran', tot.expense, 'text-expense-ink', 'r-expense')}
        {stat('Selisih', diff, diff < 0 ? 'text-expense-ink' : 'text-income-ink', 'r-diff')}
        {stat('Saldo akhir', tot.closing, 'text-ink', 'r-closing')}
      </div>
      <p className="mx-5 mt-2 text-[13px] text-mute-ink">Saldo sebelumnya {rp(tot.opening)}. Transfer antar akun tidak dihitung sebagai pemasukan atau pengeluaran.</p>

      <Breakdown title="Pengeluaran per kategori" rows={exp} />
      <Breakdown title="Pemasukan per kategori" rows={inc} />

      <section className="card mx-4 mt-4 p-4">
        <h2 className="text-[15px] font-bold">Perbandingan 6 bulan terakhir</h2>
        <div role="img" aria-label="Perbandingan pemasukan dan pengeluaran per bulan" className="mt-2 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mon} barGap={3}>
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#66707B' }} />
              <Tooltip formatter={(v: unknown) => rp(Number(v))} cursor={{ fill: '#F4F6F9' }} />
              <Bar dataKey="income" name="Pemasukan" fill="#22A06B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Pengeluaran" fill="#E5484D" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="no-print mx-4 mt-4 flex gap-3">
        <button className="btn-ghost flex-1" onClick={() => download(`laporan-${rg.label.replace(/\s+/g, '-')}.csv`, toCsv(txRows(list)))}><Download size={20} />Unduh CSV</button>
        <button className="btn-ghost flex-1" onClick={() => window.print()}><Printer size={20} />Cetak / PDF</button>
      </div>
    </Page>
  )
}
