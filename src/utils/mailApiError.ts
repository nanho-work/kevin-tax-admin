import axios from 'axios'

export function getCommonMailErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const detail = (error.response?.data as any)?.detail
    const normalizedDetail = typeof detail === 'string' ? detail.trim() : ''
    const detailLooksTechnical =
      /traceback|sql|stack|exception|axios|internal server error/i.test(normalizedDetail) ||
      normalizedDetail.length > 160

    if (status === 400) {
      if (normalizedDetail && !detailLooksTechnical) return normalizedDetail
      return '요청값을 다시 확인해 주세요.'
    }
    if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
    if (status === 403) return '권한이 없어 요청을 처리할 수 없습니다.'
    if (status === 404) return '요청한 메일 정보를 찾을 수 없습니다.'
    if (status === 409) return '현재 상태에서는 이 작업을 진행할 수 없습니다.'
    if (status === 422) {
      if (normalizedDetail && !detailLooksTechnical) return normalizedDetail
      return '입력값을 확인해 주세요.'
    }
    if (typeof status === 'number' && status >= 500) {
      return '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
    }

    if (normalizedDetail && !detailLooksTechnical) return normalizedDetail
    return '메일 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  }
  return '메일 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'
}
