export function resolveApiAssetUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null
  const value = rawUrl.trim()
  if (!value) return null

  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:') ||
    value.startsWith('blob:')
  ) {
    return value
  }

  if (value.startsWith('//')) {
    return `https:${value}`
  }

  const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || '').trim().replace(/\/+$/, '')
  const path = value.startsWith('/') ? value : `/${value}`
  if (apiBase) return `${apiBase}${path}`

  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`
  }
  return path
}
