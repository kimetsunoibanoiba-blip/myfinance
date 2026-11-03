import { useEffect, useState } from 'react'
import { BookOpen, Calculator, Calendar, ChevronRight, CloudUpload, Tag, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { go } from '../router'
import { Confirm, Page, cx } from '../ui'
import { balances } from '../lib/calc'
import { fmtStamp, num } from '../lib/format'
import { canInstall, isIOS, isStandalone, onInstallChange, promptInstall } from '../lib/install'
import type { Op } from '../types'

const opLabel = (o: Op): string => {
  switch (o.kind) {
    case 'tx.save': return `${o.isNew ? 'Tambah' : 'Ubah'} ${o.tx.type.toLowerCase()} Rp ${num(o.tx.amount)}`
    case 'tx.delete': return 'Hapus transaksi'
    case 'tx.restore': return 'Pulihkan transaksi'
    case 'tx.purge': return 'Hapus permanen transaksi'
    case 'acc.save': return `${o.isNew ? 'Tambah' : 'Ubah'} akun ${o.acc.name}`
    case 'acc.delete': return 'Hapus akun'
    case 'cat.save': return `${o.isNew ? 'Tambah' : 'Ubah'} kategori ${o.cat.name}`
    case 'cat.delete': return 'Hapus kategori'
    case 'note.save': return `${o.isNew ? 'Tambah' : 'Ubah'} catatan`
    case 'note.delete': return 'Hapus catatan'
  }
}
const STATE = { idle: 'Tersinkron', syncing: 'Sedang sinkron…', offline: 'Offline, menunggu koneksi', error: 'Ada masalah' } as const

export default function Settings() {
  const { cfg, saveCfg, state, message, lastSync, queue, refresh, retryFailed, discard, data, serverBalances, toast } = useStore()
  const [ask, setAsk] = useState(false)
  const [, bump] = useState(0)
  useEffect(() => onInstallChange(() => bump(n => n + 1)), [])
  const local = balances(data)
  const verified = serverBalances && queue.length === 0 ? Object.keys(serverBalances.accounts).every(k => Math.abs((local.accounts[k] ?? 0) - serverBalances.accounts[k]) < 1) && Math.abs(local.total - serverBalances.total) < 1 : null
  const link = (to: string, Icon: typeof Tag, text: string) => (
    <button key={to} className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-base font-semibold" onClick={() => go(to)}>
      <Icon size={22} className="text-primary-ink" aria-hidden /><span className="flex-1">{text}</span><ChevronRight size={20} className="text-mute" aria-hidden />
    </button>
  )
  return (
    <Page pad="pb-28">
      <header className="safe-t bg-primary px-4 pb-4 pt-3 text-white"><h1 className="h-11 text-xl font-bold leading-[44px]">Pengaturan</h1></header>

      <section className="card mx-4 mt-4 p-4" aria-label="Koneksi">
        <h2 className="text-[15px] font-bold">Koneksi Google Sheets</h2>
        <p className={cx('mt-1 text-base font-bold', state === 'idle' ? 'text-income-ink' : state === 'syncing' ? 'text-primary-ink' : 'text-expense-ink')} data-testid="sync-state">{STATE[state]}</p>
        {message && <p className="text-[14px] text-expense-ink">{message}</p>}
        <p className="mt-1 text-[13px] text-mute-ink">Terakhir sinkron: {fmtStamp(lastSync)}</p>
        <p className="mt-1 break-all text-[13px] text-mute-ink">{cfg ? cfg.url.replace('https://', '').slice(0, 34) + '…' + cfg.url.slice(-8) : ''}</p>
        <p className="text-[13px] text-mute-ink">Kunci akses tersimpan di perangkat ini saja.</p>
        <div className="mt-3 flex gap-2">
          <button className="btn-s flex-1 bg-primary-ink" disabled={state === 'syncing'} onClick={async () => { const ok = await refresh(); toast(ok ? 'Data terbaru dari Google Sheets dimuat' : 'Belum berhasil sinkron', ok ? 'ok' : 'warn') }}>Sinkronkan</button>
          <button className="btn-ghost flex-1" onClick={() => go('/setup')}>Ubah</button>
          <button className="btn-ghost flex-1 !border-expense !text-expense-ink" onClick={() => setAsk(true)}>Putuskan</button>
        </div>
      </section>

      {verified !== null && (
        <p className={cx('mx-5 mt-3 text-[14px] font-semibold', verified ? 'text-income-ink' : 'text-expense-ink')} role="status">
          {verified ? 'Saldo di aplikasi cocok dengan perhitungan server.' : 'Saldo di aplikasi berbeda dari server. Ketuk Sinkronkan untuk memuat ulang.'}
        </p>
      )}

      {queue.length > 0 && (
        <section className="card mx-4 mt-4 p-4" aria-label="Antrean sinkron">
          <h2 className="text-[15px] font-bold">Antrean sinkron ({queue.length})</h2>
          <ul className="mt-2 divide-y divide-line">
            {queue.map(q => (
              <li key={q.opId} className="py-2 text-[14px]">
                <p className="font-semibold">{opLabel(q.op)}</p>
                <p className={q.failed ? 'text-expense-ink' : 'text-mute-ink'}>{q.failed ? `Ditolak: ${q.error}` : 'Menunggu dikirim'}</p>
                {q.failed && <button className="mt-1 h-11 text-sm font-bold text-expense-ink underline" onClick={() => discard(q.opId)}>Buang</button>}
              </li>
            ))}
          </ul>
          {queue.some(q => q.failed) && <button className="btn-ghost mt-2 w-full" onClick={retryFailed}>Coba kirim ulang</button>}
        </section>
      )}

      <section className="card mx-4 mt-4 divide-y divide-line overflow-hidden" aria-label="Pintasan">
        {link('/kategori', Tag, 'Kategori')}
        {link('/kalender', Calendar, 'Kalender keuangan')}
        {link('/catatan', BookOpen, 'Buku catatan')}
        {link('/kalkulator', Calculator, 'Kalkulator kas')}
        {link('/sampah', Trash2, 'Transaksi yang dihapus')}
        {link('/cadangan', CloudUpload, 'Cadangkan dan pulihkan')}
      </section>

      {!isStandalone() && (
        <section className="card mx-4 mt-4 p-4" aria-label="Pasang aplikasi">
          <h2 className="text-[15px] font-bold">Pasang di layar utama</h2>
          {canInstall()
            ? <button className="btn-s mt-2 w-full bg-primary-ink" onClick={() => void promptInstall()}>Pasang MyFinance</button>
            : <p className="mt-1 text-[14px] text-mute-ink">{isIOS() ? 'Di iPhone/iPad: ketuk tombol Bagikan di Safari, lalu pilih "Tambah ke Layar Utama".' : 'Buka menu browser (titik tiga), lalu pilih "Instal aplikasi" atau "Tambahkan ke layar utama".'}</p>}
        </section>
      )}
      <p className="mt-6 text-center text-[13px] text-mute-ink">MyFinance 1.0.0</p>

      <Confirm open={ask} danger label="Putuskan" title="Putuskan koneksi?" message="Data di Google Sheets tetap aman. Aplikasi hanya melupakan URL dan kunci di perangkat ini, dan antrean yang belum terkirim akan hilang." onYes={() => { setAsk(false); saveCfg(null); go('/setup', true) }} onNo={() => setAsk(false)} />
    </Page>
  )
}
