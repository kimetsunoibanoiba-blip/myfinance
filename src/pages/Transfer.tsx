import { useEffect, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { useStore } from '../store'
import { back, go } from '../router'
import { alive } from '../lib/calc'
import { group, hhmm, isoDate, parseAmount, validDate, validTime } from '../lib/format'
import { uid } from '../lib/id'
import { Empty, MoneyInput, Page, TopBar } from '../ui'
import type { Tx } from '../types'

export default function Transfer({ id, q }: { id?: string; q: URLSearchParams }) {
  const { data, state } = useStore()
  const editing = id ? data.transactions.find(t => t.id === id && t.status === 'Aktif' && t.type === 'Transfer') : undefined
  if (id && !editing) return <Page><TopBar title="Ubah transfer" onBack={() => back('/')} /><Empty title={state === 'syncing' ? 'Memuat…' : 'Transfer tidak ditemukan'} /></Page>
  return <Inner editing={editing} from={q.get('dari') ?? ''} />
}

function Inner({ editing, from }: { editing?: Tx; from: string }) {
  const { data, submit, toast } = useStore()
  const accs = alive(data.accounts)
  const [txId] = useState(() => editing?.id ?? uid('tx_'))
  const [a, setA] = useState(editing?.accountId ?? from)
  const [b, setB] = useState(editing?.toAccountId ?? '')
  const [amount, setAmount] = useState(editing ? group(String(editing.amount)) : '')
  const [date, setDate] = useState(editing?.date ?? isoDate())
  const [time, setTime] = useState(editing?.time ?? hhmm())
  const [note, setNote] = useState(editing?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!accs.some(x => x.id === a) && accs[0]) setA(accs[0].id)
    if (!accs.some(x => x.id === b && x.id !== a) && accs.length > 1) setB((accs.find(x => x.id !== a) ?? accs[1]).id)
  }, [accs, a, b])

  const save = async () => {
    if (saving) return
    const amt = parseAmount(amount)
    const e = !amt ? 'Isi nominal transfer.' : accs.length < 2 ? 'Butuh minimal dua akun untuk transfer.' : a === b ? 'Akun asal dan tujuan tidak boleh sama.' : !validDate(date) ? 'Tanggal tidak valid.' : !validTime(time) ? 'Waktu tidak valid.' : ''
    if (e) { setErr(e); return }
    const from = accs.find(x => x.id === a), to = accs.find(x => x.id === b)
    if (!from || !to) { setErr('Pilih akun asal dan tujuan.'); return }
    setSaving(true); setErr('')
    const now = new Date().toISOString()
    const tx: Tx = { id: txId, date, time, type: 'Transfer', accountId: from.id, accountName: from.name, toAccountId: to.id, toAccountName: to.name, categoryId: '', categoryName: '', amount: amt, note: note.trim(), attachment: '', items: [], status: 'Aktif', createdAt: editing?.createdAt ?? now, updatedAt: now, deletedAt: '' }
    const r = await submit({ kind: 'tx.save', tx, isNew: !editing })
    setSaving(false)
    if (!r.ok) { setErr(r.error ?? 'Gagal menyimpan.'); return }
    toast(r.queued ? 'Disimpan di HP. Akan dikirim ke Google Sheets saat online.' : 'Transfer tersimpan di Google Sheets', r.queued ? 'warn' : 'ok')
    back('/')
  }

  const select = (label: string, value: string, onChange: (v: string) => void, skip?: string) => (
    <label className="card block px-4 py-2"><span className="lbl block !text-xs">{label}</span>
      <select className="h-9 w-full bg-transparent text-base font-bold outline-none" value={value} onChange={e => onChange(e.target.value)}>{accs.filter(x => x.id !== skip || x.id === value).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
  )

  return (
    <Page pad="pb-44">
      <TopBar title={editing ? 'Ubah transfer' : 'Transfer antar akun'} onBack={() => back('/')} />
      <div className="space-y-3 px-4 pt-4">
        {accs.length < 2 ? <div className="card p-4 text-[15px]">Transfer butuh minimal dua akun. <button className="font-bold text-primary-ink underline" onClick={() => go('/akun')}>Tambah akun</button></div> : (
          <>
            {select('Dari akun', a, setA)}
            <div className="flex justify-center text-primary-ink"><ArrowLeftRight size={22} aria-hidden /></div>
            {select('Ke akun', b, setB, a)}
          </>
        )}
        <div className="card px-4 pb-1 pt-3">
          <label htmlFor="nominal" className="lbl">Nominal</label>
          <div className="flex items-center gap-2 border-b-2 border-primary"><b className="text-xl text-mute-ink">Rp</b><MoneyInput id="nominal" value={amount} onChange={setAmount} tone="text-primary-ink" /></div>
        </div>
        <div className="flex gap-3">
          <label className="card block flex-[3] px-4 py-2"><span className="lbl block !text-xs">Tanggal</span><input type="date" className="h-9 w-full bg-transparent text-base font-bold outline-none" value={date} onChange={e => setDate(e.target.value)} /></label>
          <label className="card block flex-[2] px-4 py-2"><span className="lbl block !text-xs">Waktu</span><input type="time" className="h-9 w-full bg-transparent text-base font-bold outline-none" value={time} onChange={e => setTime(e.target.value.slice(0, 5))} /></label>
        </div>
        <input aria-label="Catatan" maxLength={500} className="input" placeholder="Catatan (opsional)" value={note} onChange={e => setNote(e.target.value)} />
        <p className="px-1 text-[13px] text-mute-ink">Transfer memindahkan saldo antar akun dan tidak dihitung sebagai pemasukan atau pengeluaran.</p>
        {err && <p role="alert" className="rounded-2xl bg-expense-soft px-4 py-3 text-[15px] font-semibold text-expense-ink">{err}</p>}
      </div>
      <div className="safe-b fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-line bg-surface px-4 pt-3">
        <button className="btn w-full bg-primary-ink" disabled={saving || accs.length < 2} onClick={save}>{saving ? 'Menyimpan…' : 'Simpan transfer'}</button>
      </div>
    </Page>
  )
}
