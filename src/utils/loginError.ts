export function toLoginErrorMessage(detail: unknown): string {
  if (typeof detail === 'string') return detail

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg?: unknown }).msg ?? '')
        }
        return ''
      })
      .filter(Boolean)

    if (messages.length > 0) return messages.join(', ')
  }

  if (detail && typeof detail === 'object' && 'msg' in detail) {
    return String((detail as { msg?: unknown }).msg ?? '로그인에 실패했습니다.')
  }

  return '로그인에 실패했습니다.'
}
