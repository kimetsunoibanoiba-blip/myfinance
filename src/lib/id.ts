export const uid = (prefix = ''): string => {
  const c = (globalThis as { crypto?: Crypto }).crypto
  const r = c && 'randomUUID' in c ? c.randomUUID().replace(/-/g, '').slice(0, 20) : Math.random().toString(36).slice(2, 12) + Date.now().toString(36)
  return prefix + r
}
