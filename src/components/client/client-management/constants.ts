export const ROLE_CODE_OPTIONS = ['CLIENT_ADMIN', 'CLIENT_STAFF'] as const

export const inputClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

export function statusMessage(status?: number, context?: 'create' | 'list' | 'delete'): string {
  if (status === 401) return '세션이 만료되었습니다. 다시 로그인해 주세요.'
  if (status === 403) return '권한이 없습니다.'
  if (status === 404) return '대상 데이터를 찾을 수 없습니다.'
  if (status === 400) {
    if (context === 'create') return '입력값을 확인해 주세요. login_id 중복 또는 client-role 불일치일 수 있습니다.'
    return '요청 값이 올바르지 않습니다.'
  }
  if (status && status >= 500) return '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  return '요청 처리 중 오류가 발생했습니다.'
}
