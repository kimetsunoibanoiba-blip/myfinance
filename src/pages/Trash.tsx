import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { back } from '../router'
import { fmtStamp } from '../lib/format'
import { Confirm, Empty, Page, TopBar, TxRow } from '../ui'
import type { Tx } from '../types'

export default function Trash() {
  const { data, submit, toast } = useStore()
  const [ask, setAsk] = useState<Tx | null>(null)
  const list = useMemo(() => data.transactions.filter(t => t.status === 'Dihapus').sort((a, b) => (b.deletedAt || b.updatedAt).localeCompare(a.deletedAt || a.updatedAt)), [data.transactions])
  const restore = async (t: Tx) => {
    const r = await submit({ kind: 'tx.restore', id: t.id })
    toast(r.ok ? (r.queued ? 'Dipulihkan di HP, menunggu sinkron.' : 'Transaksi dipulihkan') : r.error ?? 'Gagal memulihkan.', r.ok ? (r.queued ? 'warn' : 'ok') : 'err')
  }
  const purge = async () => {
    const t = ask; setAsk(null)
    if (!t) return
    const r = await submit({ kind: 'tx.purge', id: t.id })
    toast(r.ok ? (r.queued ? 'Dihapus di HP, menunggu sinkron.' : 'Dihapus permanen') : r.error ?? 'Gagal menghapus.', r.ok ? (r.queued ? 'warn' : 'ok') : 'err')
  }
  return (
    <Page>
      <TopBar title="Transaksi yang dihapus" onBack={() => back('/lainnya')} />
      <p className="px-5 pt-3 text-[14px] text-mute-ink">Transaksi di sini tidak dihitung dalam saldo. Pulihkan bila terhapus tidak sengaja.</p>
      {list.length === 0 ? <Empty title="Sampah kosong" /> : (
        <ul className="mx-4 mt-3 space-y-3">
          {list.map(t => (
            <li key={t.id} className="card overflow-hidden">
              <TxRow tx={t} showDate />
              <p className="lbl px-4 pb-1 !text-xs">Dihapus {fmtStamp(t.deletedAt || t.updatedAt)}</p>
              <div className="flex gap-2 border-t border-line p-2">
                <button className="btn-ghost flex-1 !h-11" onClick={() => void restore(t)}>Pulihkan</button>
                <button className="btn-ghost flex-1 !h-11 !border-expense !text-expense-ink" onClick={() => setAsk(t)}>Hapus permanen</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Confirm open={ask !== null} danger label="Hapus permanen" title="Hapus permanen?" message="Transaksi ini dihapus dari Google Sheets dan tidak bisa dipulihkan lagi." onYes={purge} onNo={() => setAsk(null)} />
    </Page>
  )
}
