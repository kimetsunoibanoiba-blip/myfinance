import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { back } from '../router'
import { alive } from '../lib/calc'
import { uid } from '../lib/id'
import { Confirm, Empty, Page, Seg, Sheet, TopBar } from '../ui'
import type { Category } from '../types'

export default function Categories() {
  const { data, submit, toast } = useStore()
  const [kind, setKind] = useState<'Pemasukan' | 'Pengeluaran'>('Pengeluaran')
  const [edit, setEdit] = useState<Category | 'new' | null>(null)
  const [del, setDel] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const list = alive(data.categories).filter(c => c.kind === kind)
  useEffect(() => { if (edit) { setName(edit === 'new' ? '' : edit.name); setErr('') } }, [edit])

  const save = async () => {
    const n = name.trim().replace(/\s+/g, ' ')
    const cur = edit && edit !== 'new' ? edit : undefined
    if (!n) return setErr('Nama kategori wajib diisi.')
    if (n.length > 40) return setErr('Nama kategori maksimal 40 karakter.')
    if (list.some(c => c.id !== cur?.id && c.name.toLowerCase() === n.toLowerCase())) return setErr('Kategori ini sudah ada.')
    setBusy(true)
    const now = new Date().toISOString()
    const cat: Category = { id: cur?.id ?? uid('cat_'), name: n, kind: cur?.kind ?? kind, status: 'Aktif', createdAt: cur?.createdAt ?? now, updatedAt: now }
    const r = await submit({ kind: 'cat.save', cat, isNew: !cur })
    setBusy(false)
    if (!r.ok) return setErr(r.error ?? 'Gagal menyimpan.')
    toast(r.queued ? 'Disimpan di HP, menunggu sinkron.' : 'Kategori tersimpan', r.queued ? 'warn' : 'ok')
    setEdit(null)
  }
  const remove = async () => {
    const c = del; setDel(null)
    if (!c) return
    const r = await submit({ kind: 'cat.delete', id: c.id })
    toast(r.ok ? (r.queued ? 'Dihapus di HP, menunggu sinkron.' : 'Kategori dihapus') : r.error ?? 'Gagal menghapus.', r.ok ? (r.queued ? 'warn' : 'ok') : 'err')
  }

  return (
    <Page>
      <TopBar title="Kategori" onBack={() => back('/pengaturan')} right={<button className="ib" aria-label="Tambah kategori" onClick={() => setEdit('new')}><Plus size={26} /></button>} />
      <div className="px-4 pt-4"><Seg value={kind} options={['Pemasukan', 'Pengeluaran']} onChange={setKind} /></div>
      {list.length === 0 ? <Empty title={`Belum ada kategori ${kind.toLowerCase()}`} /> : (
        <ul className="card mx-4 mt-4 divide-y divide-line overflow-hidden">
          {list.map(c => (
            <li key={c.id} className="flex min-h-14 items-center justify-between pl-4 pr-1">
              <span className="text-base font-semibold">{c.name}</span>
              <span className="flex"><button className="ib" aria-label={`Ubah ${c.name}`} onClick={() => setEdit(c)}><Pencil size={20} /></button><button className="ib" aria-label={`Hapus ${c.name}`} onClick={() => setDel(c)}><Trash2 size={20} /></button></span>
            </li>
          ))}
        </ul>
      )}
      <p className="mx-5 mt-3 text-[13px] text-mute-ink">Mengganti nama kategori ikut memperbarui riwayat transaksi. Menghapus kategori tidak menghapus transaksinya.</p>

      <Sheet open={edit !== null} title={edit === 'new' ? `Kategori ${kind.toLowerCase()} baru` : 'Ubah kategori'} onClose={() => setEdit(null)}>
        <div className="space-y-3">
          <label className="block"><span className="lbl">Nama kategori</span><input className="input mt-1" maxLength={40} value={name} onChange={e => setName(e.target.value)} /></label>
          {err && <p role="alert" className="rounded-2xl bg-expense-soft px-4 py-3 text-[15px] font-semibold text-expense-ink">{err}</p>}
          <button className="btn w-full bg-primary-ink" disabled={busy} onClick={save}>Simpan</button>
        </div>
      </Sheet>
      <Confirm open={del !== null} danger label="Hapus" title={`Hapus kategori ${del?.name ?? ''}?`} message="Transaksi lama tetap menyimpan nama kategori ini." onYes={remove} onNo={() => setDel(null)} />
    </Page>
  )
}
