export const MAIL_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function splitEmailTokens(raw: string): string[] {
  return raw
    .split(/[,\n;\s]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

export function mergeUniqueEmails(current: string[], incoming: string[]): string[] {
  const existing = new Set(current.map((email) => email.toLowerCase()))
  const next = [...current]
  for (const email of incoming) {
    const key = email.toLowerCase()
    if (existing.has(key)) continue
    existing.add(key)
    next.push(email)
  }
  return next
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(1)} GB`
}
