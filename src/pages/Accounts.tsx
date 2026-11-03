import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { back, go } from '../router'
import { alive, balances, filterTx, groupByDate, noFilter } from '../lib/calc'
import { fmtDay, group, num, parseAmount, rp } from '../lib/format'
import { uid } from '../lib/id'
import { Confirm, Empty, Page, Sheet, TopBar, TxRow } from '../ui'
import { TxDetail } from './TxDetail'
import type { Account, Tx } from '../types'

export function AccountSheet({ open, acc, onClose }: { open: boolean; acc?: Account; onClose: () => void }) {
  const { data, submit, toast } = useStore()
  const [name, setName] = useState('')
  const [opening, setOpening] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setName(acc?.name ?? ''); setOpening(acc ? group(String(Math.max(acc.openingBalance, 0))) : ''); setErr('') } }, [open, acc])
  const save = async () => {
    const n = name.trim().replace(/\s+/g, ' ')
    if (!n) return setErr('Nama akun wajib diisi.')
    if (n.length > 40) return setErr('Nama akun maksimal 40 karakter.')
    if (alive(data.accounts).some(a => a.id !== acc?.id && a.name.toLowerCase() === n.toLowerCase())) return setErr('Nama akun sudah dipakai.')
    setBusy(true); setErr('')
    const now = new Date().toISOString()
    const a: Account = { id: acc?.id ?? uid('acc_'), name: n, openingBalance: parseAmount(opening), status: 'Aktif', createdAt: acc?.createdAt ?? now, updatedAt: now }
    const r = await submit({ kind: 'acc.save', acc: a, isNew: !acc })
    setBusy(false)
    if (!r.ok) return setErr(r.error ?? 'Gagal menyimpan akun.')
    toast(r.queued ? 'Akun disimpan di HP, menunggu sinkron.' : 'Akun tersimpan di Google Sheets', r.queued ? 'warn' : 'ok')
    onClose()
  }
  return (
    <Sheet open={open} title={acc ? 'Ubah akun' : 'Tambah akun'} onClose={onClose}>
      <div className="space-y-3">
        <label className="block"><span className="lbl">Nama akun</span><input className="input mt-1" maxLength={40} placeholder="mis. Cash, BCA, E-Wallet" value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="block"><span className="lbl">Saldo awal (Rp)</span><input className="input mt-1" inputMode="numeric" placeholder="0" value={opening} onChange={e => setOpening(group(e.target.value))} /></label>
        {err && <p role="alert" className="rounded-2xl bg-expense-soft px-4 py-3 text-[15px] font-semibold text-expense-ink">{err}</p>}
        <button className="btn w-full bg-primary-ink" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
      </div>
    </Sheet>
  )
}

export default function Accounts() {
  const { data } = useStore()
  const [add, setAdd] = useState(false)
  const accs = alive(data.accounts)
  const bal = useMemo(() => balances(data), [data])
  return (
    <Page pad="pb-28">
      <TopBar title="Akun" right={<button className="ib" aria-label="Tambah akun" onClick={() => setAdd(true)}><Plus size={26} /></button>} />
      <div className="card mx-4 mt-4 p-4"><p className="lbl">Total saldo semua akun</p><p className="mt-1 text-3xl font-extrabold" data-testid="total-saldo">{rp(bal.total)}</p></div>
      {accs.length === 0 ? <Empty title="Belum ada akun" hint="Tambahkan akun seperti Cash, BCA, atau E-Wallet." action={<button className="btn-s bg-primary-ink" onClick={() => setAdd(true)}>Tambah akun</button>} /> : (
        <div className="card mx-4 mt-4 divide-y divide-line overflow-hidden">
          {accs.map(a => (
            <button key={a.id} className="flex min-h-16 w-full items-center justify-between px-4 text-left" onClick={() => go('/akun/' + a.id)}>
              <span className="text-base font-bold">{a.name}</span>
              <span className="text-base font-bold">{rp(bal.accounts[a.id] ?? 0)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="mx-4 mt-4 flex gap-3">
        <button className="btn-ghost flex-1" onClick={() => setAdd(true)}><Plus size={20} />Tambah akun</button>
        <button className="btn-ghost flex-1" onClick={() => go('/transfer')}><ArrowLeftRight size={20} />Transfer</button>
      </div>
      <AccountSheet open={add} onClose={() => setAdd(false)} />
    </Page>
  )
}

export function AccountDetail({ id }: { id: string }) {
  const { data, submit, toast, pending } = useStore()
  const acc = data.accounts.find(a => a.id === id && a.status === 'Aktif')
  const [edit, setEdit] = useState(false)
  const [ask, setAsk] = useState(false)
  const [sel, setSel] = useState<Tx | null>(null)
  const bal = useMemo(() => balances(data), [data])
  const groups = useMemo(() => groupByDate(filterTx(alive(data.transactions), { ...noFilter, accountId: id })), [data, id])
  if (!acc) return <Page><TopBar title="Akun" onBack={() => back('/akun')} /><Empty title="Akun tidak ditemukan" /></Page>
  const del = async () => {
    setAsk(false)
    const r = await submit({ kind: 'acc.delete', id })
    if (r.ok) { toast(r.queued ? 'Dihapus di HP, menunggu sinkron.' : 'Akun dihapus', r.queued ? 'warn' : 'ok'); go('/akun', true) } else toast(r.error ?? 'Gagal menghapus akun.', 'err')
  }
  return (
    <Page pad="pb-10">
      <TopBar title={acc.name} onBack={() => back('/akun')} right={<><button className="ib" aria-label="Ubah akun" onClick={() => setEdit(true)}><Pencil size={22} /></button><button className="ib" aria-label="Hapus akun" onClick={() => setAsk(true)}><Trash2 size={22} /></button></>} />
      <div className="card mx-4 mt-4 p-4">
        <p className="lbl">Saldo saat ini</p><p className="mt-1 text-3xl font-extrabold" data-testid="saldo-akun">{rp(bal.accounts[id] ?? 0)}</p>
        <p className="mt-1 text-[13px] text-mute-ink">Saldo awal {rp(acc.openingBalance)}</p>
        <button className="btn-ghost mt-3 w-full" onClick={() => go('/transfer?dari=' + id)}><ArrowLeftRight size={20} />Transfer dari akun ini</button>
      </div>
      <h2 className="px-5 pt-4 text-[17px] font-bold">Riwayat transaksi</h2>
      {groups.length === 0 ? <Empty title="Belum ada transaksi di akun ini" /> : (
        <div className="space-y-4 px-4 pt-2">
          {groups.map(g => (
            <section key={g.date}>
              <h3 className="mb-1 px-1 text-sm font-bold">{fmtDay(g.date)}</h3>
              <div className="card divide-y divide-line overflow-hidden">{g.items.map(t => <TxRow key={t.id} tx={t} pending={pending.has(t.id)} onClick={() => setSel(t)} />)}</div>
            </section>
          ))}
        </div>
      )}
      <AccountSheet open={edit} acc={acc} onClose={() => setEdit(false)} />
      <Confirm open={ask} danger label="Hapus" title={`Hapus akun ${acc.name}?`} message={`Akun yang masih memiliki transaksi tidak bisa dihapus. Saldo saat ini ${rp(bal.accounts[id] ?? 0)} (Rp ${num(Math.abs(bal.accounts[id] ?? 0))}) tidak dihitung lagi setelah akun dihapus.`} onYes={del} onNo={() => setAsk(false)} />
      <TxDetail tx={sel} onClose={() => setSel(null)} />
    </Page>
  )
}
