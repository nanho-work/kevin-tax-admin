import axios from 'axios'

type DetailObject = {
  code?: unknown
  message?: unknown
  request_id?: unknown
  detail?: unknown
  [key: string]: unknown
}

function firstValidationMessage(detail: unknown): string | null {
  if (!Array.isArray(detail) || detail.length === 0) return null
  const first = detail[0]
  if (typeof first === 'string' && first.trim()) return first.trim()
  if (first && typeof first === 'object') {
    const msg = (first as { msg?: unknown }).msg
    if (typeof msg === 'string' && msg.trim()) return msg.trim()
  }
  return null
}

export function getApiErrorMessageFromDetail(detail: unknown, fallback: string): string {
  if (typeof detail === 'string' && detail.trim()) return detail.trim()

  const validationMessage = firstValidationMessage(detail)
  if (validationMessage) return validationMessage

  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const obj = detail as DetailObject
    if (typeof obj.message === 'string' && obj.message.trim()) return obj.message.trim()
    if (typeof obj.detail === 'string' && obj.detail.trim()) return obj.detail.trim()
    if (typeof obj.code === 'string' && obj.code.trim()) return obj.code.trim()
  }

  return fallback
}

export function getApiErrorMessage(error: unknown, fallback = '요청 처리 중 오류가 발생했습니다.'): string {
  if (!axios.isAxiosError(error)) return fallback
  return getApiErrorMessageFromDetail((error.response?.data as { detail?: unknown } | undefined)?.detail, fallback)
}

export function getApiErrorCode(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null
  const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const code = (detail as DetailObject).code
    if (typeof code === 'string' && code.trim()) return code.trim()
  }
  return null
}

export function getApiRequestId(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null
  const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const requestId = (detail as DetailObject).request_id
    if (typeof requestId === 'string' && requestId.trim()) return requestId.trim()
  }
  return null
}

