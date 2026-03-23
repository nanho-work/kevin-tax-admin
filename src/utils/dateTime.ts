const NAIVE_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(?:\.\d{1,6})?)?$/
const TZ_INFO_RE = /(Z|[+-]\d{2}:?\d{2})$/i

function parseDate(value: string, assumeUtcIfNaive: boolean): Date {
  const raw = value.trim()
  if (assumeUtcIfNaive && NAIVE_DATETIME_RE.test(raw) && !TZ_INFO_RE.test(raw)) {
    return new Date(`${raw.replace(' ', 'T')}Z`)
  }
  return new Date(raw)
}

export function formatKSTDateTime(value?: string | null, fallback = '-'): string {
  if (!value) return fallback
  const date = parseDate(value, false)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}

export function formatKSTDate(value?: string | null, fallback = '-'): string {
  if (!value) return fallback
  const date = parseDate(value, true)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
}

export function formatKSTDateTimeAssumeUTC(value?: string | null, fallback = '-'): string {
  if (!value) return fallback
  const date = parseDate(value, true)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}

export function formatKSTDateTimeMinute(value?: string | null, fallback = '-'): string {
  if (!value) return fallback
  const date = parseDate(value, true)
  if (Number.isNaN(date.getTime())) return value
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || '00'
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

export function formatKSTDateTimeKorean(value?: string | null, fallback = '-'): string {
  if (!value) return fallback
  const date = parseDate(value, true)
  if (Number.isNaN(date.getTime())) return value
  const dateFmt = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date)
  const timeFmt = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const getDate = (type: Intl.DateTimeFormatPartTypes) => dateFmt.find((p) => p.type === type)?.value || ''
  const getTime = (type: Intl.DateTimeFormatPartTypes) => timeFmt.find((p) => p.type === type)?.value || '00'
  return `${getDate('year')}년 ${getDate('month')}월 ${getDate('day')}일 (${getDate('weekday')}) ${getTime('hour')}:${getTime('minute')}`
}
