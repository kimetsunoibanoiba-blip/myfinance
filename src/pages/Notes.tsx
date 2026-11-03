import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useStore } from '../store'
import { back } from '../router'
import { alive } from '../lib/calc'
import { fmtDate, hhmm, isoDate, validDate, validTime } from '../lib/format'
import { uid } from '../lib/id'
import { Confirm, Empty, Page, Sheet, TopBar, cx } from '../ui'
import type { Note } from '../types'

export default function Notes() {
  const { data, submit, toast } = useStore()
  const [tab, setTab] = useState<'Semua' | 'Tertunda' | 'Selesai'>('Semua')
  const [edit, setEdit] = useState<Note | 'new' | null>(null)
  const [del, setDel] = useState<Note | null>(null)
  const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [date, setDate] = useState(''); const [time, setTime] = useState(''); const [done, setDone] = useState(false)
  const [err, setErr] = useState('')
  const all = useMemo(() => alive(data.notes).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)), [data.notes])
  const list = all.filter(n => tab === 'Semua' || (tab === 'Selesai') === n.done)
  const nDone = all.filter(n => n.done).length

  useEffect(() => {
    if (!edit) return
    const n = edit === 'new' ? null : edit
    setTitle(n?.title ?? ''); setBody(n?.body ?? ''); setDate(n?.date ?? isoDate()); setTime(n?.time ?? hhmm()); setDone(n?.done ?? false); setErr('')
  }, [edit])

  const persist = async (n: Note, isNew: boolean) => {
    const r = await submit({ kind: 'note.save', note: n, isNew })
    if (!r.ok) { toast(r.error ?? 'Gagal menyimpan catatan.', 'err'); return false }
    toast(r.queued ? 'Disimpan di HP, menunggu sinkron.' : 'Catatan tersimpan', r.queued ? 'warn' : 'ok')
    return true
  }
  const save = async () => {
    const cur = edit && edit !== 'new' ? edit : undefined
    if (!title.trim() && !body.trim()) return setErr('Isi judul atau catatan.')
    if (!validDate(date) || !validTime(time)) return setErr('Tanggal atau waktu tidak valid.')
    const now = new Date().toISOString()
    const n: Note = { id: cur?.id ?? uid('note_'), date, time, title: title.trim(), body: body.trim(), done, status: 'Aktif', createdAt: cur?.createdAt ?? now, updatedAt: now }
    if (await persist(n, !cur)) setEdit(null)
  }
  const remove = async () => {
    const n = del; setDel(null)
    if (!n) return
    const r = await submit({ kind: 'note.delete', id: n.id })
    toast(r.ok ? 'Catatan dihapus' : r.error ?? 'Gagal menghapus.', r.ok ? 'ok' : 'err')
  }

  return (
    <Page pad="pb-36">
      <TopBar title="Buku catatan" onBack={() => back('/lainnya')} />
      <div className="flex gap-2 px-4 pt-4" role="group" aria-label="Filter status">
        {(['Semua', 'Tertunda', 'Selesai'] as const).map(t => <button key={t} aria-pressed={tab === t} className={cx('chip', tab === t && 'chip-on')} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {list.length === 0 ? <Empty title="Belum ada catatan" hint="Ketuk tombol + untuk menambahkan." /> : (
        <ul className="card mx-4 mt-4 divide-y divide-line overflow-hidden">
          {list.map(n => (
            <li key={n.id} className="flex items-start gap-2 py-2 pl-2 pr-4">
              <input type="checkbox" aria-label={`Tandai selesai: ${n.title || n.body.slice(0, 20)}`} className="mt-3 h-6 w-6 shrink-0 accent-primary" checked={n.done} onChange={e => void persist({ ...n, done: e.target.checked, updatedAt: new Date().toISOString() }, false)} />
              <button className="min-h-12 flex-1 py-1 text-left" onClick={() => setEdit(n)}>
                <span className={cx('block text-[15px] font-bold', n.done && 'text-mute-ink line-through')}>{n.title || n.body}</span>
                {n.title && n.body && <span className="block truncate text-[14px] text-mute-ink">{n.body}</span>}
                <span className="lbl block !text-xs">{fmtDate(n.date)}, {n.time}</span>
              </button>
              <button className="h-11 px-2 text-sm font-bold text-expense-ink" aria-label="Hapus catatan" onClick={() => setDel(n)}>Hapus</button>
            </li>
          ))}
        </ul>
      )}
      <button className="fixed bottom-24 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary-ink text-white shadow-lg" aria-label="Tambah catatan" onClick={() => setEdit('new')}><Plus size={28} /></button>
      <div className="safe-b fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md justify-around border-t border-line bg-white pt-2 text-center" aria-label="Ringkasan">
        <div><p className="lbl">Selesai</p><p className="font-bold text-income-ink">{nDone}</p></div>
        <div><p className="lbl">Tertunda</p><p className="font-bold text-expense-ink">{all.length - nDone}</p></div>
        <div><p className="lbl">Total</p><p className="font-bold">{all.length}</p></div>
      </div>

      <Sheet open={edit !== null} title={edit === 'new' ? 'Catatan baru' : 'Ubah catatan'} onClose={() => setEdit(null)}>
        <div className="space-y-3">
          <input className="input" aria-label="Judul" maxLength={100} placeholder="Judul" value={title} onChange={e => setTitle(e.target.value)} />
          <textarea className="input !h-28 py-3" aria-label="Isi catatan" maxLength={2000} placeholder="Isi catatan" value={body} onChange={e => setBody(e.target.value)} />
          <div className="flex gap-3"><input type="date" className="input flex-[3]" aria-label="Tanggal" value={date} onChange={e => setDate(e.target.value)} /><input type="time" className="input flex-[2]" aria-label="Waktu" value={time} onChange={e => setTime(e.target.value.slice(0, 5))} /></div>
          <label className="flex min-h-11 items-center gap-3 text-base font-semibold"><input type="checkbox" className="h-6 w-6 accent-primary" checked={done} onChange={e => setDone(e.target.checked)} />Tandai selesai</label>
          {err && <p role="alert" className="rounded-2xl bg-expense-soft px-4 py-3 text-[15px] font-semibold text-expense-ink">{err}</p>}
          <button className="btn w-full bg-primary-ink" onClick={save}>Simpan</button>
        </div>
      </Sheet>
      <Confirm open={del !== null} danger label="Hapus" title="Hapus catatan?" message="Catatan ini akan dihapus dari daftar." onYes={remove} onNo={() => setDel(null)} />
    </Page>
  )
}
