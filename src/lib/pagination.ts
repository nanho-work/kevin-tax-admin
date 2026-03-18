export const MAX_PAGE_SIZE = 100
export const DEFAULT_PAGE_SIZE = 20
export const DEFAULT_PAGE = 1

export function normalizePage(page: unknown, fallback = DEFAULT_PAGE): number {
  const parsed = Number(page)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.trunc(parsed))
}

export function normalizePageSize(
  size: unknown,
  fallback = DEFAULT_PAGE_SIZE,
  maxSize = MAX_PAGE_SIZE
): number {
  const parsed = Number(size)
  if (!Number.isFinite(parsed)) return Math.min(Math.max(1, fallback), maxSize)
  return Math.min(Math.max(1, Math.trunc(parsed)), maxSize)
}
