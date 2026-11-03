import { useRef, useState } from 'react'
import { useStore } from '../store'
import { back } from '../router'
import { alive } from '../lib/calc'
import { download, makeBackup, parseBackup, toCsv, txRows, type Backup as BackupFile } from '../lib/csv'
import { fmtStamp, isoDate } from '../lib/format'
import { Confirm, Page, TopBar } from '../ui'

interface Counts { accounts: number; categories: number; transactions: number; notes: number; skipped: number }
interface Plan { backup?: BackupFile; counts?: Counts; errors?: string[]; error?: string }

export default function Backup() {
  const { data, call, refresh, toast, queue } = useStore()
  const [busy, setBusy] = useState('')
  const [last, setLast] = useState<{ name: string; url: string; at: string } | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [ask, setAsk] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const msg = (e: unknown) => (e instanceof Error ? e.message : 'Terjadi kesalahan.')

  const driveBackup = async () => {
    setBusy('drive')
    try { const r = await call<{ name: string; url: string; at: string }>('backup.now'); setLast(r); toast('Backup tersimpan di Google Drive Anda') } catch (e) { toast(msg(e), 'err') } finally { setBusy('') }
  }
  const pickFile = async (f: File) => {
    setBusy('check'); setPlan(null)
    try {
      const p = parseBackup(await f.text())
      if (!p.ok) { setPlan({ error: p.error }); return }
      const r = await call<{ counts: Counts; errors: string[] }>('restore.apply', { backup: p.backup, dryRun: true })
      setPlan({ backup: p.backup, counts: r.counts, errors: r.errors })
    } catch (e) { setPlan({ error: msg(e) }) } finally { setBusy('') }
  }
  const apply = async () => {
    setAsk(false)
    if (!plan?.backup) return
    setBusy('apply')
    try {
      const r = await call<{ applied: boolean; counts: Counts }>('restore.apply', { backup: plan.backup })
      toast(r.applied ? 'Pemulihan selesai. Salinan pengaman sudah dibuat di Google Drive.' : 'Pemulihan tidak dijalankan.', r.applied ? 'ok' : 'warn')
      setPlan(null); await refresh()
    } catch (e) { toast(msg(e), 'err') } finally { setBusy('') }
  }
  const c = plan?.counts
  const nothing = c && c.accounts + c.categories + c.transactions + c.notes === 0

  return (
    <Page>
      <TopBar title="Cadangkan dan pulihkan" onBack={() => back('/pengaturan')} />
      <div className="space-y-4 p-4">
        <section className="card p-4">
          <h2 className="text-[15px] font-bold">Backup ke Google Drive</h2>
          <p className="mt-1 text-[14px] text-mute-ink">Membuat salinan seluruh spreadsheet di folder "MyFinance Backup" (8 salinan terbaru disimpan). Untuk backup otomatis tiap minggu, jalankan fungsi <b>installBackupTrigger</b> sekali di Apps Script.</p>
          <button className="btn-s mt-3 w-full bg-primary-ink" disabled={busy !== ''} onClick={() => void driveBackup()}>{busy === 'drive' ? 'Membuat backup…' : 'Backup sekarang'}</button>
          {last && <p className="mt-2 text-[14px] text-income-ink" role="status">Selesai {fmtStamp(last.at)}: <a className="font-bold underline" href={last.url} target="_blank" rel="noopener noreferrer">{last.name}</a></p>}
        </section>

        <section className="card p-4">
          <h2 className="text-[15px] font-bold">Unduh ke perangkat</h2>
          <div className="mt-3 flex gap-3">
            <button className="btn-ghost flex-1" onClick={() => download(`myfinance-backup-${isoDate()}.json`, JSON.stringify(makeBackup(data), null, 2), 'application/json')}>File backup</button>
            <button className="btn-ghost flex-1" onClick={() => download(`transaksi-${isoDate()}.csv`, toCsv(txRows([...alive(data.transactions)].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)))))}>CSV transaksi</button>
          </div>
        </section>

        <section className="card p-4">
          <h2 className="text-[15px] font-bold">Pulihkan dari file backup</h2>
          <p className="mt-1 text-[14px] text-mute-ink">Pemulihan hanya MENAMBAH data yang belum ada. Data yang sudah ada tidak pernah ditimpa, dan salinan pengaman dibuat dulu di Google Drive.</p>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void pickFile(f); e.target.value = '' }} />
          <button className="btn-ghost mt-3 w-full" disabled={busy !== '' || queue.length > 0} onClick={() => fileRef.current?.click()}>{busy === 'check' ? 'Memeriksa file…' : 'Pilih file backup (.json)'}</button>
          {queue.length > 0 && <p className="mt-2 text-[13px] text-mute-ink">Selesaikan sinkronisasi yang tertunda dulu.</p>}
          {plan?.error && <p role="alert" className="mt-3 rounded-2xl bg-expense-soft px-4 py-3 text-[15px] font-semibold text-expense-ink">{plan.error}</p>}
          {plan?.errors && plan.errors.length > 0 && (
            <div role="alert" className="mt-3 rounded-2xl bg-expense-soft px-4 py-3 text-[14px] text-expense-ink"><p className="font-bold">File ditolak, tidak ada data yang diubah:</p><ul className="mt-1 list-disc pl-4">{plan.errors.slice(0, 6).map(x => <li key={x}>{x}</li>)}</ul></div>
          )}
          {c && plan?.errors?.length === 0 && (
            <div className="mt-3 rounded-2xl bg-surface p-3 text-[15px]" role="status">
              <p className="font-bold">Hasil pemeriksaan</p>
              <p>Akan ditambahkan: {c.accounts} akun, {c.categories} kategori, {c.transactions} transaksi, {c.notes} catatan.</p>
              <p className="text-mute-ink">Dilewati karena sudah ada: {c.skipped}.</p>
              <button className="btn-s mt-3 w-full bg-primary-ink" disabled={!!nothing || busy !== ''} onClick={() => setAsk(true)}>{nothing ? 'Tidak ada yang perlu dipulihkan' : 'Terapkan pemulihan'}</button>
            </div>
          )}
        </section>

        <button className="btn-ghost w-full" disabled={busy !== ''} onClick={() => void refresh().then(ok => toast(ok ? 'Data dimuat ulang dari Google Sheets' : 'Belum berhasil sinkron', ok ? 'ok' : 'warn'))}>Muat ulang dari Google Sheets</button>
      </div>
      <Confirm open={ask} label="Pulihkan" title="Terapkan pemulihan?" message="Data baru akan ditambahkan ke Google Sheets Anda. Data yang sudah ada tidak diubah." onYes={() => void apply()} onNo={() => setAsk(false)} />
    </Page>
  )
}
