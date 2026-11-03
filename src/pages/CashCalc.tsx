import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { useStore } from '../store'
import { back } from '../router'
import { num } from '../lib/format'
import { Page, TopBar } from '../ui'

const DENOMS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50]

export default function CashCalc() {
  const { toast } = useStore()
  const [c, setC] = useState<Record<number, string>>({})
  const qty = (d: number) => Math.max(0, parseInt(c[d] ?? '0', 10) || 0)
  const set = (d: number, v: number) => setC(x => ({ ...x, [d]: String(Math.max(0, Math.min(99999, v))) }))
  const total = DENOMS.reduce((s, d) => s + d * qty(d), 0)
  const share = async () => {
    const text = ['Hitung kas MyFinance', ...DENOMS.filter(d => qty(d) > 0).map(d => `Rp ${num(d)} x ${qty(d)} = Rp ${num(d * qty(d))}`), `Total: Rp ${num(total)}`].join('\n')
    try {
      if (navigator.share) await navigator.share({ text })
      else { await navigator.clipboard.writeText(text); toast('Hasil disalin ke clipboard') }
    } catch { /* dibatalkan pengguna */ }
  }
  return (
    <Page pad="pb-44">
      <TopBar title="Kalkulator kas" onBack={() => back('/lainnya')} />
      <ul className="card mx-4 mt-4 divide-y divide-line">
        {DENOMS.map(d => (
          <li key={d} className="flex items-center gap-1.5 px-3 py-1.5">
            <span className="w-[66px] text-right text-[15px] font-bold">{num(d)}</span>
            <span className="text-mute-ink" aria-hidden>×</span>
            <button className="ib !w-10 bg-surface" aria-label={`Kurangi lembar ${num(d)}`} onClick={() => set(d, qty(d) - 1)}><Minus size={18} /></button>
            <input aria-label={`Jumlah lembar ${num(d)}`} className="h-11 w-14 rounded-xl border border-line text-center text-base font-bold outline-none focus:border-primary" inputMode="numeric" placeholder="0" value={c[d] ?? ''} onChange={e => set(d, parseInt(e.target.value.replace(/\D/g, '') || '0', 10))} />
            <button className="ib !w-10 bg-surface" aria-label={`Tambah lembar ${num(d)}`} onClick={() => set(d, qty(d) + 1)}><Plus size={18} /></button>
            <span className="flex-1 text-right text-[13px] font-semibold text-mute-ink">{qty(d) ? num(d * qty(d)) : ''}</span>
          </li>
        ))}
      </ul>
      <div className="safe-b fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-line bg-surface px-4 pt-3">
        <p className="flex items-baseline justify-between"><span className="text-base font-bold">Total</span><span className="text-3xl font-extrabold" data-testid="kas-total">Rp {num(total)}</span></p>
        <div className="mt-2 flex gap-3"><button className="btn-ghost flex-1" onClick={() => setC({})}>Hapus</button><button className="btn-s flex-1 bg-primary-ink" onClick={share}>Bagikan</button></div>
      </div>
    </Page>
  )
}
