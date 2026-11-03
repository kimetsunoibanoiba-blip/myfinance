import { useEffect, useState, type ReactNode, type Ref } from 'react'
import { AlertTriangle, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, Cloud, CloudOff, Home, List, RefreshCw, Settings, Wallet, X } from 'lucide-react'
import { useStore } from './store'
import { go } from './router'
import type { Tx } from './types'
import { fmtDate, group, num } from './lib/format'
import { newPeriod, PERIODS, range, shift, type Period } from './lib/period'

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

export function Page({ children, pad = 'pb-10' }: { children: ReactNode; pad?: string }) {
  return <div className={cx('page-in mx-auto min-h-full w-full max-w-md bg-surface', pad)}>{children}</div>
}

export function TopBar({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="safe-t sticky top-0 z-20 bg-primary text-white">
      <div className="flex h-16 items-center gap-1 px-2">
        {onBack && <button className="ib" aria-label="Kembali" onClick={onBack}><ChevronLeft size={26} /></button>}
        <h1 className={cx('flex-1 truncate text-xl font-bold', !onBack && 'px-2')}>{title}</h1>
        {right}
      </div>
    </header>
  )
}

export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="sheet-in safe-b max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-4" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="ib" aria-label="Tutup" onClick={onClose}><X size={22} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Confirm({ open, title, message, label = 'Ya', danger, onYes, onNo }: { open: boolean; title: string; message: string; label?: string; danger?: boolean; onYes: () => void; onNo: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-6" onClick={onNo}>
      <div role="alertdialog" aria-modal="true" aria-label={title} className="w-full max-w-sm rounded-3xl bg-white p-5" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-2 text-[15px] text-mute-ink">{message}</p>
        <div className="mt-5 flex gap-3">
          <button className="btn-ghost flex-1" onClick={onNo}>Batal</button>
          <button className={cx('btn-s flex-1', danger ? 'bg-expense-ink' : 'bg-primary-ink')} onClick={onYes}>{label}</button>
        </div>
      </div>
    </div>
  )
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-base font-bold">{title}</p>
      {hint && <p className="mt-1 text-[15px] text-mute-ink">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function ToastHost() {
  const { toasts } = useStore()
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] mx-auto flex max-w-md flex-col gap-2 px-4" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={cx('toast-in rounded-2xl px-4 py-3 text-[15px] font-semibold text-white shadow-lg', t.kind === 'ok' && 'bg-income-ink', t.kind === 'warn' && 'bg-ink', t.kind === 'err' && 'bg-expense-ink')}>{t.msg}</div>
      ))}
    </div>
  )
}

/** Ikon status sinkron di header; ketuk untuk melihat detail di Pengaturan. */
export function SyncBadge() {
  const { state, queue } = useStore()
  const pending = queue.filter(q => !q.failed).length
  const failed = queue.filter(q => q.failed).length
  const [Icon, label] = state === 'syncing' ? [RefreshCw, 'Sedang sinkron'] : state === 'offline' ? [CloudOff, `Offline, ${pending} menunggu kirim`] : failed || state === 'error' ? [AlertTriangle, 'Ada masalah sinkron'] : [Cloud, 'Tersinkron dengan Google Sheets']
  return <button className="ib" aria-label={label} title={label} onClick={() => go('/pengaturan')}><Icon size={22} className={state === 'syncing' ? 'spin' : ''} /></button>
}

export function Seg<T extends string>({ value, options, onChange, tones }: { value: T; options: T[]; onChange: (v: T) => void; tones?: Partial<Record<T, string>> }) {
  return (
    <div className="flex gap-2" role="group">
      {options.map(o => <button key={o} aria-pressed={value === o} onClick={() => onChange(o)} className={cx('chip flex-1', value === o && (tones?.[o] ?? 'chip-on'))}>{o}</button>)}
    </div>
  )
}

export function MoneyInput({ id, value, onChange, tone, inputRef }: { id: string; value: string; onChange: (v: string) => void; tone: string; inputRef?: Ref<HTMLInputElement> }) {
  return <input id={id} ref={inputRef} inputMode="numeric" autoComplete="off" placeholder="0" value={value} onChange={e => onChange(group(e.target.value))} className={cx('h-16 w-full min-w-0 bg-transparent text-[44px] font-extrabold outline-none placeholder:text-line', tone)} />
}

export function TxRow({ tx, onClick, showDate, pending }: { tx: Tx; onClick?: () => void; showDate?: boolean; pending?: boolean }) {
  const income = tx.type === 'Pemasukan', transfer = tx.type === 'Transfer'
  const tone = transfer ? 'text-primary-ink' : income ? 'text-income-ink' : 'text-expense-ink'
  const soft = transfer ? 'bg-primary-soft' : income ? 'bg-income-soft' : 'bg-expense-soft'
  const Icon = transfer ? ArrowLeftRight : income ? ArrowDownLeft : ArrowUpRight
  const title = transfer ? `${tx.accountName} → ${tx.toAccountName}` : tx.categoryName || tx.type
  const sub = [!transfer && tx.accountName, tx.note].filter(Boolean).join(', ') || tx.type
  return (
    <button onClick={onClick} className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left">
      <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', tone, soft)}><Icon size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold">{title}</span>
        <span className="block truncate text-[13px] text-mute-ink">{sub}</span>
      </span>
      <span className="text-right">
        <span className={cx('block text-base font-bold', tone)}>{transfer ? '' : income ? '+' : '−'}Rp {num(tx.amount)}</span>
        <span className="block text-[13px] text-mute-ink">{showDate ? fmtDate(tx.date).slice(0, 6) : tx.time}</span>
        {pending && <span className="block text-[11px] font-bold text-primary-ink">Menunggu sinkron</span>}
      </span>
    </button>
  )
}

export function PeriodNav({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const rg = range(value)
  const can = value.kind === 'today' || value.kind === 'week' || value.kind === 'month' || value.kind === 'year'
  return (
    <div className="flex items-center">
      {can && <button className="ib !w-9" aria-label="Periode sebelumnya" onClick={() => onChange(shift(value, -1))}><ChevronLeft size={20} /></button>}
      <span className="px-1 text-[13px] font-bold">{rg.label}</span>
      {can && <button className="ib !w-9" aria-label="Periode berikutnya" onClick={() => onChange(shift(value, 1))}><ChevronRight size={20} /></button>}
    </div>
  )
}

export function PeriodBar({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const [open, setOpen] = useState(false)
  const [a, setA] = useState(value.from)
  const [b, setB] = useState(value.to)
  const pick = (kind: Period['kind']) => { if (kind === 'custom') { setA(value.from); setB(value.to); setOpen(true) } else onChange(newPeriod(kind)) }
  return (
    <>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-1" role="group" aria-label="Filter periode">
        {PERIODS.map(p => <button key={p.kind} aria-pressed={value.kind === p.kind} className={cx('chip', value.kind === p.kind && 'chip-on')} onClick={() => pick(p.kind)}>{p.label}</button>)}
      </div>
      <Sheet open={open} title="Rentang tanggal" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <label className="block"><span className="lbl">Dari tanggal</span><input type="date" className="input mt-1" value={a} onChange={e => setA(e.target.value)} /></label>
          <label className="block"><span className="lbl">Sampai tanggal</span><input type="date" className="input mt-1" value={b} onChange={e => setB(e.target.value)} /></label>
          <button className="btn w-full bg-primary-ink" disabled={!a || !b} onClick={() => { onChange({ kind: 'custom', anchor: a, from: a, to: b }); setOpen(false) }}>Terapkan</button>
        </div>
      </Sheet>
    </>
  )
}

const TABS = [
  { to: '/', label: 'Beranda', Icon: Home }, { to: '/transaksi', label: 'Transaksi', Icon: List }, { to: '/laporan', label: 'Laporan', Icon: BarChart3 },
  { to: '/akun', label: 'Akun', Icon: Wallet }, { to: '/pengaturan', label: 'Pengaturan', Icon: Settings }
]
export const isTab = (path: string) => TABS.some(t => t.to === path)

export function BottomNav({ path }: { path: string }) {
  return (
    <nav aria-label="Menu utama" className="nav-h no-print fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md border-t border-line bg-white">
      {TABS.map(({ to, label, Icon }) => {
        const on = path === to
        return (
          <button key={to} aria-current={on ? 'page' : undefined} onClick={() => go(to)} className={cx('flex flex-1 flex-col items-center justify-center gap-0.5 text-xs', on ? 'font-bold text-primary-ink' : 'font-semibold text-mute-ink')}>
            <span className={cx('flex h-[30px] w-14 items-center justify-center rounded-full', on && 'bg-primary-soft')}><Icon size={22} /></span>
            {label}
          </button>
        )
      })}
    </nav>
  )
}
