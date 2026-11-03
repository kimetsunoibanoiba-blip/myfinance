// Simulasi layanan Google Apps Script di memori, untuk menjalankan apps-script/Code.gs apa adanya.
// Perilaku dibuat seketat Sheets asli: menulis di luar baris maksimum gagal, teks mirip tanggal
// otomatis menjadi Date bila kolom tidak berformat teks ('@'), dan Date dibuat di realm yang sama dengan kode.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const CODE = fs.readFileSync(path.join(here, '../apps-script/Code.gs'), 'utf8')

export function harness() {
  const ctx = vm.createContext({})
  const Dt = vm.runInContext('Date', ctx)
  const logs = []
  const lock = { busy: false, acquired: 0, released: 0 }
  const props = new Map()
  const drive = { folders: new Map(), copies: [], created: [] }
  const triggers = []
  let tick = 0

  class Sheet {
    constructor(name) { this.name = name; this.rows = []; this.maxRows = 1000; this.fmt = {}; this.frozen = 0 }
    get(r, c) { const row = this.rows[r - 1]; const v = row ? row[c - 1] : undefined; return v === undefined ? '' : v }
    set(r, c, v) {
      if (r > this.maxRows) throw new Error('mock: baris ' + r + ' di luar sheet (maks ' + this.maxRows + ')')
      if (typeof v === 'string' && this.fmt[c] !== '@') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) v = new Dt(v + 'T00:00:00Z')
        else if (/^\d{2}:\d{2}$/.test(v)) v = new Dt('1899-12-30T' + v + ':00Z')
      }
      while (this.rows.length < r) this.rows.push([])
      const row = this.rows[r - 1]
      while (row.length < c) row.push('')
      row[c - 1] = v
    }
    getLastRow() { for (let r = this.rows.length; r > 0; r--) if (this.rows[r - 1].some(v => v !== '' && v !== undefined && v !== null)) return r; return 0 }
    getLastColumn() { let m = 0; this.rows.forEach(row => row.forEach((v, i) => { if (v !== '' && v !== undefined && v !== null) m = Math.max(m, i + 1) })); return m }
    getMaxRows() { return this.maxRows }
    insertRowsAfter(after, n) { this.maxRows += n }
    deleteRow(r) { this.rows.splice(r - 1, 1) }
    setFrozenRows(n) { this.frozen = n }
    getRange(r, c, nr = 1, nc = 1) {
      if (!(r >= 1 && c >= 1 && nr >= 1 && nc >= 1)) throw new Error(`mock: koordinat range tidak valid (${r},${c},${nr},${nc})`)
      const sh = this
      return {
        getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push(sh.get(r + i, c + j)); out.push(row) } return out },
        setValues(v) { if (v.length !== nr || v[0].length !== nc) throw new Error('mock: ukuran setValues tidak cocok'); for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) sh.set(r + i, c + j, v[i][j]); return this },
        setValue(v) { sh.set(r, c, v); return this },
        setNumberFormat(f) { for (let j = 0; j < nc; j++) sh.fmt[c + j] = f; return this },
        setFontWeight() { return this }
      }
    }
  }
  const sheets = new Map()
  const ss = {
    getSheetByName: n => sheets.get(n) || null,
    insertSheet: n => { const s = new Sheet(n); sheets.set(n, s); return s },
    getSpreadsheetTimeZone: () => 'Asia/Jakarta', getName: () => 'Keuangan Saya', getId: () => 'ss-123'
  }
  const iter = arr => ({ i: 0, hasNext() { return this.i < arr.length }, next() { return arr[this.i++] } })
  const mkFile = name => {
    const id = 'f' + (++tick)
    return { id, name, trashed: false, created: new Dt(1700000000000 + tick * 1000), getName() { return this.name }, getDateCreated() { return this.created }, setTrashed(v) { this.trashed = v }, getUrl() { return 'https://drive.google.com/file/d/' + id }, getId() { return id } }
  }
  const mkFolder = name => ({ name, files: [], getFiles() { return iter(this.files.filter(f => !f.trashed)) }, createFile(blob) { const f = mkFile(blob.getName()); f.blob = blob; this.files.push(f); drive.created.push(f); return f } })

  Object.assign(ctx, {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush() {} },
    LockService: { getScriptLock: () => ({ tryLock() { if (lock.busy) return false; lock.acquired++; return true }, releaseLock() { lock.released++ } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (props.has(k) ? props.get(k) : null), setProperty: (k, v) => props.set(k, v) }) },
    ContentService: { MimeType: { JSON: 'JSON' }, createTextOutput: s => ({ s, setMimeType() { return this }, getContent() { return this.s } }) },
    Session: { getScriptTimeZone: () => 'Asia/Jakarta' },
    Logger: { log: x => logs.push(String(x)) },
    console: { error() {}, log() {} },
    Utilities: {
      getUuid: () => randomUUID(),
      formatDate: (d, tz, f) => { const p = n => String(n).padStart(2, '0'); return f.replace('yyyy', d.getUTCFullYear()).replace('MM', p(d.getUTCMonth() + 1)).replace('dd', p(d.getUTCDate())).replace('HH', p(d.getUTCHours())).replace('mm', p(d.getUTCMinutes())) },
      base64Decode: s => Array.from(Buffer.from(s, 'base64')),
      newBlob: (bytes, mime, name) => ({ bytes, mime, getName: () => name })
    },
    DriveApp: {
      getFoldersByName: n => iter(drive.folders.has(n) ? [drive.folders.get(n)] : []),
      createFolder: n => { const f = mkFolder(n); drive.folders.set(n, f); return f },
      getFileById: () => ({ makeCopy(name, folder) { const f = mkFile(name); folder.files.push(f); drive.copies.push(f); return f } })
    },
    ScriptApp: {
      WeekDay: { SUNDAY: 'SUNDAY' },
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger: t => { const i = triggers.indexOf(t); if (i >= 0) triggers.splice(i, 1) },
      newTrigger: fn => { const t = { fn, getHandlerFunction: () => fn }; const b = { timeBased: () => b, onWeekDay: () => b, atHour: () => b, create: () => { triggers.push(t); return t } }; return b }
    }
  })
  vm.runInContext(CODE, ctx)

  const h = {
    ctx, ss, sheets, lock, logs, props, drive, triggers,
    setup() { ctx.setupMyFinance(); return props.get('ACCESS_KEY') },
    api(action, payload = {}, key) {
      const k = key === undefined ? props.get('ACCESS_KEY') : key
      return JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ action, key: k, payload }) } }).getContent())
    },
    raw(contents) { return JSON.parse(ctx.doPost({ postData: { contents } }).getContent()) },
    headers: key => Array.from(vm.runInContext(`TABLES.${key}.cols.map(c => c[1])`, ctx)),
    sheet: n => sheets.get(n)
  }
  return h
}
