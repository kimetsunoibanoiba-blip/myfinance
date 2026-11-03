import { useState } from 'react'
import { useStore } from '../store'
import { go } from '../router'
import { Confirm, Sheet, cx } from '../ui'
import { fmtDate, num } from '../lib/format'
import type { Tx } from '../types'

const Row = ({ k, v }: { k: string; v?: string }) => (v ? <div className="flex justify-between gap-4 py-2.5"><dt className="lbl">{k}</dt><dd className="text-right text-[15px] font-semibold">{v}</dd></div> : null)

export function TxDetail({ tx, onClose }: { tx: Tx | null; onClose: () => void }) {
  const { submit, toast } = useStore()
  const [ask, setAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!tx) return null
  const income = tx.type === 'Pemasukan', transfer = tx.type === 'Transfer'
  const del = async () => {
    setBusy(true)
    const r = await submit({ kind: 'tx.delete', id: tx.id, at: new Date().toISOString() })
    setBusy(false); setAsk(false)
    if (r.ok) { toast(r.queued ? 'Dihapus di HP. Menunggu sinkron.' : 'Dipindahkan ke Sampah', r.queued ? 'warn' : 'ok'); onClose() } else toast(r.error ?? 'Gagal menghapus.', 'err')
  }
  return (
    <>
      <Sheet open title="Detail transaksi" onClose={onClose}>
        <div className={cx('text-3xl font-extrabold', transfer ? 'text-primary-ink' : income ? 'text-income' : 'text-expense')}>{transfer ? '' : income ? '+' : '−'}Rp {num(tx.amount)}</div>
        <dl className="mt-3 divide-y divide-line">
          <Row k="Jenis" v={tx.type} />
          <Row k="Tanggal" v={`${fmtDate(tx.date)}, ${tx.time}`} />
          <Row k={transfer ? 'Dari akun' : 'Akun'} v={tx.accountName} />
          <Row k="Ke akun" v={tx.toAccountName} />
          <Row k="Kategori" v={tx.categoryName} />
          <Row k="Catatan" v={tx.note} />
        </dl>
        {tx.items.length > 0 && (
          <div className="mt-3 rounded-2xl bg-surface p-3 text-[14px]">
            <p className="lbl mb-1">Rincian barang</p>
            {tx.items.map((i, n) => <div key={n} className="flex justify-between"><span>{i.name} ({i.qty} {i.unit})</span><span className="font-semibold">Rp {num(i.qty * i.price)}</span></div>)}
          </div>
        )}
        {tx.attachment && <a className="mt-3 block text-[15px] font-bold text-primary-ink underline" href={tx.attachment} target="_blank" rel="noopener noreferrer">Buka lampiran</a>}
        <div className="mt-5 flex gap-3">
          <button className="btn-ghost flex-1" onClick={() => { onClose(); go(transfer ? `/transfer/${tx.id}` : `/tx/${tx.id}`) }}>Ubah</button>
          <button className="btn-s flex-1 bg-expense-ink" disabled={busy} onClick={() => setAsk(true)}>Hapus</button>
        </div>
      </Sheet>
      <Confirm open={ask} danger label="Hapus" title="Hapus transaksi?" message="Transaksi dipindahkan ke Sampah dan bisa dipulihkan kapan saja." onYes={del} onNo={() => setAsk(false)} />
    </>
  )
}
