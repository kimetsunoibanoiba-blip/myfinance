// Penyimpanan di perangkat HANYA untuk antrean kirim dan salinan baca-saja (cache). Data utama tetap di Google Sheets.
const DB = 'myfinance'
const ST = 'kv'
const mem = new Map<string, unknown>()
let dbp: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1)
      r.onupgradeneeded = () => r.result.createObjectStore(ST)
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  }
  return dbp
}

export async function kvGet<T>(k: string): Promise<T | undefined> {
  try {
    const db = await open()
    return await new Promise<T | undefined>((res, rej) => {
      const q = db.transaction(ST).objectStore(ST).get(k)
      q.onsuccess = () => res(q.result as T | undefined)
      q.onerror = () => rej(q.error)
    })
  } catch { return mem.get(k) as T | undefined }
}

export async function kvSet(k: string, v: unknown): Promise<void> {
  mem.set(k, v)
  try {
    const db = await open()
    await new Promise<void>((res, rej) => {
      const t = db.transaction(ST, 'readwrite')
      t.objectStore(ST).put(v, k)
      t.oncomplete = () => res()
      t.onerror = () => rej(t.error)
    })
  } catch { /* mode privat: tetap tersimpan di memori selama aplikasi terbuka */ }
}
