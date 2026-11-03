import { useState } from 'react'
import { useStore } from '../store'
import { back, go, useRoute } from '../router'
import { call, okUrl } from '../lib/api'
import { Page } from '../ui'

export default function Setup() {
  const { cfg, saveCfg, toast } = useStore()
  const r = useRoute()
  const [url, setUrl] = useState(r.q.get('url') ?? cfg?.url ?? '')
  const [key, setKey] = useState(r.q.get('key') ?? cfg?.key ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const connect = async () => {
    setErr('')
    const c = { url: url.trim(), key: key.trim() }
    if (!okUrl(c.url)) return setErr('URL harus alamat Web App Google, bentuknya https://script.google.com/macros/s/…/exec')
    if (c.key.length < 16) return setErr('Kunci akses terlalu pendek. Salin utuh dari log fungsi setupMyFinance.')
    setBusy(true)
    try {
      const d = await call<{ spreadsheet: string }>(c, 'ping')
      saveCfg(c)
      toast(`Terhubung ke "${d.spreadsheet}"`)
      go('/', true)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Gagal terhubung.') } finally { setBusy(false) }
  }

  return (
    <Page>
      <div className="safe-t bg-primary px-5 pb-10 pt-8 text-white">
        <h1 className="text-3xl font-extrabold">MyFinance</h1>
        <p className="mt-1 text-lg font-semibold">Hubungkan ke Google Sheets Anda</p>
      </div>
      <div className="card relative mx-4 -mt-6 space-y-4 p-4">
        <label className="block"><span className="lbl">URL Web App (Apps Script)</span>
          <input className="input mt-1 !h-auto py-3 text-sm" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="https://script.google.com/macros/s/…/exec" value={url} onChange={e => setUrl(e.target.value)} /></label>
        <label className="block"><span className="lbl">Kunci akses</span>
          <input className="input mt-1 text-sm" type="password" autoCapitalize="off" autoCorrect="off" spellCheck={false} autoComplete="off" placeholder="Dari log setupMyFinance" value={key} onChange={e => setKey(e.target.value)} /></label>
        {err && <p role="alert" className="rounded-2xl bg-expense-soft px-4 py-3 text-[15px] font-semibold text-expense-ink">{err}</p>}
        <button className="btn w-full bg-primary-ink" disabled={busy || !url || !key} onClick={connect}>{busy ? 'Menghubungkan…' : 'Hubungkan'}</button>
        {cfg && <button className="btn-ghost w-full" onClick={() => back('/pengaturan')}>Batal</button>}
      </div>
      <ol className="mx-6 mt-5 list-decimal space-y-1 pl-4 text-[14px] text-mute-ink">
        <li>Tempel Code.gs di Apps Script pada spreadsheet Anda, lalu jalankan <b>setupMyFinance</b>.</li>
        <li>Terapkan sebagai Aplikasi Web (akses: Siapa saja) dan salin URL yang berakhiran /exec.</li>
        <li>Salin kunci akses dari log eksekusi. Kunci hanya disimpan di perangkat ini, tidak ada di kode aplikasi.</li>
      </ol>
    </Page>
  )
}
