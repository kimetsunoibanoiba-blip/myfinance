export interface Upload { name: string; mime: string; data: string }
const MAX = 1280

const toB64 = (blob: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader()
  r.onload = () => res(String(r.result).split(',')[1] ?? '')
  r.onerror = () => rej(new Error('Gagal membaca file.'))
  r.readAsDataURL(blob)
})

/** Foto dikecilkan (maks 1280 px, JPEG) agar cepat terunggah; PDF dikirim apa adanya (maks 3 MB). */
export async function prepareUpload(file: File): Promise<Upload> {
  if (file.type === 'application/pdf') {
    if (file.size > 3 * 1024 * 1024) throw new Error('PDF terlalu besar (maksimal 3 MB).')
    return { name: file.name, mime: file.type, data: await toB64(file) }
  }
  if (!file.type.startsWith('image/')) throw new Error('Lampiran harus berupa foto atau PDF.')
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  const blob = await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Gagal memproses foto.'))), 'image/jpeg', 0.8))
  return { name: file.name.replace(/\.\w+$/, '') + '.jpg', mime: 'image/jpeg', data: await toB64(blob) }
}
