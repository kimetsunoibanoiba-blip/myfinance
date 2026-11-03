type Deferred = Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> }
let deferred: Deferred | null = null
const subs = new Set<() => void>()
const emit = () => subs.forEach(f => f())

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as Deferred; emit() })
window.addEventListener('appinstalled', () => { deferred = null; emit() })

export const canInstall = () => deferred !== null
export const onInstallChange = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
export async function promptInstall() {
  if (!deferred) return false
  deferred.prompt()
  const r = await deferred.userChoice
  deferred = null; emit()
  return r.outcome === 'accepted'
}
