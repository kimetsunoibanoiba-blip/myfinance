import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Balances, Cfg, Data, Op, Queued, Result } from './types'
import { ApiErr, call as rawCall } from './lib/api'
import { kvGet, kvSet } from './lib/db'
import { applyOp, toRequest, viewOf } from './lib/ops'
import { uid } from './lib/id'
import { newPeriod, type Period } from './lib/period'

export const EMPTY: Data = { accounts: [], categories: [], transactions: [], notes: [] }
export type SyncState = 'idle' | 'syncing' | 'offline' | 'error'
export interface Toast { id: number; msg: string; kind: 'ok' | 'warn' | 'err' }
type Boot = Data & { balances: Balances }

export interface Ctx {
  cfg: Cfg | null; saveCfg: (c: Cfg | null) => void
  data: Data; ready: boolean
  state: SyncState; message: string; lastSync: string; queue: Queued[]; pending: Set<string>
  serverBalances: Balances | null
  refresh: () => Promise<boolean>
  submit: (op: Op) => Promise<Result>
  retryFailed: () => void; discard: (opId: string) => void
  call: <T = unknown>(action: string, payload?: unknown) => Promise<T>
  toast: (msg: string, kind?: Toast['kind']) => void; toasts: Toast[]
  period: Period; setPeriod: (p: Period) => void
  scope: string; setScope: (id: string) => void
}

const C = createContext<Ctx>(null as unknown as Ctx)
export const useStore = () => useContext(C)

const loadCfg = (): Cfg | null => { try { const s = localStorage.getItem('mf.cfg'); return s ? (JSON.parse(s) as Cfg) : null } catch { return null } }

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cfg, setCfgState] = useState<Cfg | null>(loadCfg)
  const [server, setServerState] = useState<Data>(EMPTY)
  const [queue, setQueueState] = useState<Queued[]>([])
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<SyncState>('idle')
  const [message, setMessage] = useState('')
  const [lastSync, setLastSync] = useState('')
  const [srvBal, setSrvBal] = useState<Balances | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [period, setPeriod] = useState<Period>(() => newPeriod('month'))
  const [scope, setScope] = useState('all')
  const R = useRef({ cfg: cfg as Cfg | null, server: EMPTY, queue: [] as Queued[], flushing: null as Promise<void> | null, waiters: new Map<string, (r: Result) => void>(), backoff: 0, last: 0 })
  R.current.cfg = cfg

  const setServer = useCallback((d: Data) => { R.current.server = d; setServerState(d); void kvSet('mf.snapshot', { data: d, at: new Date().toISOString() }) }, [])
  const setQueue = useCallback((q: Queued[]) => { R.current.queue = q; setQueueState(q); void kvSet('mf.queue', q) }, [])

  const toast = useCallback((msg: string, kind: Toast['kind'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t.slice(-2), { id, msg, kind }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), kind === 'ok' ? 3200 : 5500)
  }, [])

  /** Mengirim antrean satu per satu (berurutan). Notifikasi "berhasil" hanya muncul setelah backend mengonfirmasi. */
  const flush = useCallback((): Promise<void> => {
    const r = R.current
    if (r.flushing) return r.flushing
    const settle = (res: Result) => { r.waiters.forEach(w => w(res)); r.waiters.clear() }
    const run = async () => {
      while (r.cfg) {
        const head = r.queue.find(o => !o.failed)
        if (!head) break
        if (!navigator.onLine || Date.now() < r.backoff) { setState('offline'); settle({ ok: true, queued: true }); return }
        setState('syncing')
        try {
          const { action, payload } = toRequest(head.op)
          await rawCall(r.cfg, action, payload)
          setQueue(r.queue.filter(o => o.opId !== head.opId))
          setServer(applyOp(r.server, head.op))
          const w = r.waiters.get(head.opId)
          if (w) { w({ ok: true }); r.waiters.delete(head.opId) }
        } catch (e) {
          if (e instanceof ApiErr && e.retry) { r.backoff = Date.now() + 8000; setState('offline'); setMessage(e.message); settle({ ok: true, queued: true }); return }
          const msg = e instanceof Error ? e.message : 'Ditolak server.'
          const w = r.waiters.get(head.opId)
          if (w) { setQueue(r.queue.filter(o => o.opId !== head.opId)); w({ ok: false, error: msg }); r.waiters.delete(head.opId) }
          else { setQueue(r.queue.map(o => (o.opId === head.opId ? { ...o, failed: true, error: msg } : o))); toast('Ada data yang ditolak server. Lihat Pengaturan > Status sinkron.', 'err') }
        }
      }
      if (r.waiters.size) settle({ ok: true, queued: true })
      setState(r.queue.some(o => o.failed) ? 'error' : 'idle')
      setMessage('')
    }
    r.flushing = run().finally(() => { r.flushing = null })
    return r.flushing
  }, [setQueue, setServer, toast])

  const refresh = useCallback(async (): Promise<boolean> => {
    const r = R.current
    if (!r.cfg) return false
    await flush()
    if (r.queue.some(o => !o.failed)) return false
    setState('syncing')
    try {
      const d = await rawCall<Boot>(r.cfg, 'bootstrap')
      setServer({ accounts: d.accounts, categories: d.categories, transactions: d.transactions, notes: d.notes })
      setSrvBal(d.balances); setLastSync(new Date().toISOString()); r.last = Date.now()
      setState(r.queue.some(o => o.failed) ? 'error' : 'idle'); setMessage('')
      return true
    } catch (e) {
      setState(e instanceof ApiErr && e.retry ? 'offline' : 'error')
      setMessage(e instanceof Error ? e.message : 'Gagal sinkron.')
      return false
    }
  }, [flush, setServer])

  const submit = useCallback(async (op: Op): Promise<Result> => {
    const r = R.current
    const item: Queued = { opId: uid('op_'), op, at: new Date().toISOString() }
    setQueue([...r.queue, item])
    if (!r.cfg) return { ok: true, queued: true }
    const p = new Promise<Result>(res => r.waiters.set(item.opId, res))
    void (r.flushing ? r.flushing.then(flush) : flush())
    return p
  }, [flush, setQueue])

  const retryFailed = useCallback(() => {
    setQueue(R.current.queue.map(o => (o.failed ? { opId: o.opId, op: o.op, at: o.at } : o)))
    R.current.backoff = 0
    void flush()
  }, [flush, setQueue])
  const discard = useCallback((opId: string) => { setQueue(R.current.queue.filter(o => o.opId !== opId)); setState(s => (s === 'error' ? 'idle' : s)) }, [setQueue])

  const saveCfg = useCallback((c: Cfg | null) => {
    const old = R.current.cfg
    try { if (c) localStorage.setItem('mf.cfg', JSON.stringify(c)); else localStorage.removeItem('mf.cfg') } catch { /* abaikan */ }
    if (!c || (old && old.url !== c.url)) { setServer(EMPTY); setQueue([]); setSrvBal(null); setLastSync('') }   // jangan campur data dua spreadsheet
    R.current.cfg = c
    setCfgState(c)
  }, [setServer, setQueue])

  const call = useCallback(<T,>(action: string, payload?: unknown): Promise<T> => {
    if (!R.current.cfg) return Promise.reject(new ApiErr('no_cfg', 'Belum terhubung ke Google Sheets.'))
    return rawCall<T>(R.current.cfg, action, payload, 60000)
  }, [])

  useEffect(() => {
    let off = false
    void (async () => {
      const [snap, q] = await Promise.all([kvGet<{ data: Data; at: string }>('mf.snapshot'), kvGet<Queued[]>('mf.queue')])
      if (off) return
      if (snap?.data) { R.current.server = snap.data; setServerState(snap.data); setLastSync(snap.at) }
      if (q) { R.current.queue = q; setQueueState(q) }
      setReady(true)
    })()
    return () => { off = true }
  }, [])

  useEffect(() => { if (ready && cfg) void refresh() }, [ready, cfg, refresh])

  useEffect(() => {
    const kick = () => { R.current.backoff = 0; if (R.current.cfg && R.current.queue.some(o => !o.failed)) void flush() }
    const vis = () => { if (document.visibilityState === 'visible') { kick(); if (R.current.cfg && Date.now() - R.current.last > 60000) void refresh() } }
    window.addEventListener('online', kick)
    document.addEventListener('visibilitychange', vis)
    const t = setInterval(kick, 30000)
    return () => { window.removeEventListener('online', kick); document.removeEventListener('visibilitychange', vis); clearInterval(t) }
  }, [flush, refresh])

  const data = useMemo(() => viewOf(server, queue), [server, queue])
  const pending = useMemo(() => {
    const s = new Set<string>()
    queue.forEach(q => { if (!q.failed) { const o = q.op; if (o.kind === 'tx.save') s.add(o.tx.id); else if (o.kind.startsWith('tx.')) s.add((o as { id: string }).id) } })
    return s
  }, [queue])

  const value: Ctx = { cfg, saveCfg, data, ready, state, message, lastSync, queue, pending, serverBalances: srvBal, refresh, submit, retryFailed, discard, call, toast, toasts, period, setPeriod, scope, setScope }
  return <C.Provider value={value}>{children}</C.Provider>
}
