import { ArrowLeftRight, BookOpen, Calculator, Calendar, CloudUpload, Download, Tag, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { back, go } from '../router'
import { alive } from '../lib/calc'
import { download, toCsv, txRows } from '../lib/csv'
import { fmtStamp, isoDate } from '../lib/format'
import { Page, TopBar, cx } from '../ui'

export default function More() {
  const { data, state, lastSync, refresh, queue } = useStore()
  const pending = queue.filter(q => !q.failed).length
  const tiles = [
    { Icon: ArrowLeftRight, t: 'Transfer', s: 'Pindahkan saldo antar akun', run: () => go('/transfer') },
    { Icon: Calendar, t: 'Kalender', s: 'Lihat transaksi per tanggal', run: () => go('/kalender') },
    { Icon: Tag, t: 'Kategori', s: 'Atur kategori masuk dan keluar', run: () => go('/kategori') },
    { Icon: Calculator, t: 'Kalkulator kas', s: 'Hitung uang tunai per pecahan', run: () => go('/kalkulator') },
    { Icon: BookOpen, t: 'Buku catatan', s: 'Catatan dan pengingat', run: () => go('/catatan') },
    { Icon: Trash2, t: 'Transaksi dihapus', s: 'Pulihkan atau hapus permanen', run: () => go('/sampah') },
    { Icon: CloudUpload, t: 'Backup dan restore', s: 'Simpan dan pulihkan data', run: () => go('/cadangan') },
    { Icon: Download, t: 'Ekspor CSV', s: 'Unduh semua transaksi', run: () => download(`transaksi-${isoDate()}.csv`, toCsv(txRows([...alive(data.transactions)].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))))) }
  ]
  const ok = state === 'idle'
  return (
    <Page>
      <TopBar title="Menu lainnya" onBack={() => back('/')} />
      <div className="space-y-4 p-4">
        <div className="card flex items-center gap-3 p-4">
          <i className={cx('h-3 w-3 shrink-0 rounded-full', ok ? 'bg-income' : state === 'syncing' ? 'bg-primary' : 'bg-expense')} aria-hidden />
          <div className="flex-1">
            <p className="text-[15px] font-bold">{ok ? 'Tersinkron dengan Google Sheets' : state === 'syncing' ? 'Sedang sinkron…' : state === 'offline' ? `Offline, ${pending} menunggu kirim` : 'Ada masalah sinkron'}</p>
            <p className="lbl">Terakhir diperbarui {fmtStamp(lastSync)}</p>
          </div>
          <button className="chip" disabled={state === 'syncing'} onClick={() => void refresh()}>Sinkronkan</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map(({ Icon, t, s, run }) => (
            <button key={t} className="card min-h-[136px] p-4 text-left" onClick={run}>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary-ink"><Icon size={22} /></span>
              <b className="mt-2.5 block text-[15px]">{t}</b>
              <span className="lbl block !font-medium">{s}</span>
            </button>
          ))}
        </div>
      </div>
    </Page>
  )
}
