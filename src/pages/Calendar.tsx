import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '../store'
import { back } from '../router'
import { alive, dayMap, filterTx, noFilter } from '../lib/calc'
import { fmtDay, isoDate, MON, num, rp } from '../lib/format'
import { Empty, Page, TopBar, TxRow, cx } from '../ui'
import { TxDetail } from './TxDetail'
import type { Tx } from '../types'

const HEAD = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

export default function CalendarPage() {
  const { data, pending } = useStore()
  const today = isoDate()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [day, setDay] = useState(today)
  const [sel, setSel] = useState<Tx | null>(null)
  const txs = useMemo(() => alive(data.transactions), [data])
  const map = useMemo(() => dayMap(txs), [txs])
  const [y, m] = month.split('-').map(Number)
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)]
  const shiftMonth = (n: number) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); setMonth(d.toISOString().slice(0, 7)) }
  const dayList = useMemo(() => filterTx(txs.filter(t => t.date === day), noFilter), [txs, day])
  const sum = map[day] ?? { income: 0, expense: 0, count: 0 }

  return (
    <Page>
      <TopBar title="Kalender keuangan" onBack={() => back('/lainnya')} />
      <div className="card mx-4 mt-4 p-3">
        <div className="flex items-center justify-between">
          <button className="ib" aria-label="Bulan sebelumnya" onClick={() => shiftMonth(-1)}><ChevronLeft size={22} /></button>
          <h2 className="text-base font-bold">{MON[m - 1]} {y}</h2>
          <button className="ib" aria-label="Bulan berikutnya" onClick={() => shiftMonth(1)}><ChevronRight size={22} /></button>
        </div>
        <div className="mt-1 grid grid-cols-7 text-center">{HEAD.map(h => <span key={h} className="lbl py-1 !text-xs">{h}</span>)}</div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            if (d === null) return <span key={'x' + i} />
            const ds = `${month}-${String(d).padStart(2, '0')}`
            const info = map[ds]
            return (
              <button key={ds} aria-pressed={day === ds} aria-label={`${d} ${MON[m - 1]}${info ? `, ${info.count} transaksi` : ''}`} onClick={() => setDay(ds)}
                className={cx('flex h-12 flex-col items-center justify-center rounded-xl text-[15px] font-semibold', day === ds ? 'bg-primary-soft font-bold text-primary-ink' : ds === today && 'ring-1 ring-primary')}>
                {d}
                <span className="flex h-2 gap-0.5">{info?.income ? <i className="h-1.5 w-1.5 rounded-full bg-income" /> : null}{info?.expense ? <i className="h-1.5 w-1.5 rounded-full bg-expense" /> : null}</span>
              </button>
            )
          })}
        </div>
      </div>

      <h2 className="px-5 pt-4 text-[17px] font-bold">{fmtDay(day)}</h2>
      <div className="mx-4 mt-2 flex gap-3">
        <div className="card flex-1 p-3"><p className="lbl">Pemasukan</p><p className="text-lg font-extrabold text-income-ink" data-testid="cal-income">Rp {num(sum.income)}</p></div>
        <div className="card flex-1 p-3"><p className="lbl">Pengeluaran</p><p className="text-lg font-extrabold text-expense-ink" data-testid="cal-expense">Rp {num(sum.expense)}</p></div>
      </div>
      {dayList.length === 0 ? <Empty title="Tidak ada transaksi pada tanggal ini" /> : <div className="card mx-4 mt-3 divide-y divide-line overflow-hidden">{dayList.map(t => <TxRow key={t.id} tx={t} pending={pending.has(t.id)} onClick={() => setSel(t)} />)}</div>}
      <p className="sr-only">Selisih hari ini {rp(sum.income - sum.expense)}</p>
      <TxDetail tx={sel} onClose={() => setSel(null)} />
    </Page>
  )
}
