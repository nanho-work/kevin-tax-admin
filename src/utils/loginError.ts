import { getApiErrorMessageFromDetail } from '@/utils/apiError'

export function toLoginErrorMessage(detail: unknown): string {
  return getApiErrorMessageFromDetail(detail, '로그인에 실패했습니다.')
}
