import { useEffect, type ReactNode } from 'react'
import { useStore } from './store'
import { go, useRoute } from './router'
import { BottomNav, isTab, ToastHost } from './ui'
import Home from './pages/Home'
import Transactions from './pages/Transactions'
import TxForm from './pages/TxForm'
import Transfer from './pages/Transfer'
import Reports from './pages/Reports'
import Accounts, { AccountDetail } from './pages/Accounts'
import Settings from './pages/Settings'
import More from './pages/More'
import CalendarPage from './pages/Calendar'
import Categories from './pages/Categories'
import CashCalc from './pages/CashCalc'
import Notes from './pages/Notes'
import Trash from './pages/Trash'
import Backup from './pages/Backup'
import Setup from './pages/Setup'

export default function App() {
  const r = useRoute()
  const { cfg, ready } = useStore()
  useEffect(() => { if (ready && !cfg && r.path !== '/setup') go('/setup', true) }, [ready, cfg, r.path])
  if (!ready) return <div className="flex h-full items-center justify-center text-mute-ink">Memuat…</div>

  const [p0, p1] = r.parts
  let page: ReactNode
  if (!cfg) page = <Setup />
  else {
    switch (p0 ?? '') {
      case 'transaksi': page = <Transactions />; break
      case 'laporan': page = <Reports />; break
      case 'akun': page = p1 ? <AccountDetail id={p1} /> : <Accounts />; break
      case 'pengaturan': page = <Settings />; break
      case 'tx': page = <TxForm key={p1} id={p1 === 'baru' ? undefined : p1} q={r.q} />; break
      case 'transfer': page = <Transfer key={p1 ?? 'baru'} id={p1} q={r.q} />; break
      case 'lainnya': page = <More />; break
      case 'kalender': page = <CalendarPage />; break
      case 'kategori': page = <Categories />; break
      case 'kalkulator': page = <CashCalc />; break
      case 'catatan': page = <Notes />; break
      case 'sampah': page = <Trash />; break
      case 'cadangan': page = <Backup />; break
      case 'setup': page = <Setup />; break
      default: page = <Home />
    }
  }
  return (
    <>
      {page}
      {cfg && isTab(r.path) && <BottomNav path={r.path} />}
      <ToastHost />
    </>
  )
}
