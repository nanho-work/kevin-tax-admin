export const MAIL_COUNTS_REFRESH_EVENT = 'mail:counts-refresh'

export function emitMailCountsRefresh() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(MAIL_COUNTS_REFRESH_EVENT))
}

