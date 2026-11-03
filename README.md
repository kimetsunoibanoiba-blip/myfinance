# MyFinance — Personal Finance Tracker (PWA)

Aplikasi pencatatan keuangan pribadi yang dipakai dari HP dan menyimpan data langsung ke **Google Sheets** milik Anda.
Panduan pemasangan langkah demi langkah ada di dokumen **Panduan MyFinance** (dikirim bersama paket ini).

## Cara kerja

```
HP (PWA: React + TypeScript + Tailwind)
   │  POST text/plain (kunci akses di body)
   ▼
Google Apps Script Web App  ── validasi, kunci tulis (LockService), soft delete, saldo
   ▼
Google Sheets milik Anda  (Transaksi, Akun, Kategori, Catatan)  + Google Drive (lampiran, backup)
```

- Google Sheets adalah **satu-satunya database**. HP hanya menyimpan (a) antrean kirim saat offline dan (b) salinan baca-saja di IndexedDB.
- Notifikasi "tersimpan" baru muncul setelah backend mengonfirmasi. Saat offline, data masuk antrean berlabel "Menunggu sinkron" dan dikirim otomatis.
- Setiap transaksi punya ID unik dari HP; backend menolak duplikat, jadi klik ganda atau kirim ulang tidak membuat data ganda.
- Saldo selalu dihitung dari transaksi (tidak disimpan), sehingga tidak bisa melenceng.

## Struktur folder

```
apps-script/Code.gs        Backend (tempel ke Apps Script) + appsscript.json
src/lib/                   Logika murni: saldo, periode, filter, CSV, antrean (diuji)
src/store.tsx              State + mesin sinkron (antrean, retry, offline)
src/pages/                 Layar: Beranda, Transaksi, Form, Transfer, Laporan, Akun, Kalender,
                           Kategori, Kalkulator kas, Catatan, Sampah, Backup, Pengaturan, Setup
public/                    manifest, service worker, halaman offline, ikon
tests/                     Uji logika, uji backend (simulator Google), harness
.github/workflows/         Deploy otomatis ke GitHub Pages
```

## Perintah

```bash
npm install        # sekali
npm run dev        # pengembangan lokal (http://localhost:5173)
npm run build      # hasil di dist/ (siap diunggah ke hosting statis berbasis HTTPS)
npm test           # uji logika + uji backend
npm run typecheck  # opsional; build tidak bergantung padanya
```

## Keamanan

- Tidak ada kunci/token di kode aplikasi. URL Web App dan **kunci akses** dimasukkan sekali di layar Hubungkan dan hanya disimpan di perangkat.
- Spreadsheet tidak perlu dibagikan publik: Web App berjalan atas nama pemilik. Akses ke Web App dibatasi kunci akses (40 karakter acak).
- Sheet yang sudah ada tidak pernah diubah atau dihapus. Jika nama sheet bentrok dengan kolom berbeda, backend berhenti dengan pesan jelas (atur `CFG.PREFIX`).

## Status pengujian (jujur)

Lolos di lingkungan pengembangan: 17 uji logika, 22 uji backend terhadap simulator Google yang menjalankan `Code.gs` apa adanya,
18 langkah uji end-to-end di Chromium (termasuk offline, klik ganda, hapus/pulihkan, transfer, backup/restore), dan 6 uji PWA.
**Belum teruji di lingkungan pengembangan:** koneksi ke Google Sheets/Apps Script sungguhan, `npm install`/`vite build` dengan Tailwind
(tanpa internet saat pengembangan), tampilan visual hasil Tailwind, dan pemasangan di HP asli. Gunakan daftar uji di Panduan.
