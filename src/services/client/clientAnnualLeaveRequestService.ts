import type { AxiosError } from 'axios'
import { clientHttp } from '@/services/http'
import type {
  AnnualLeaveRequest,
  AnnualLeaveRequestListResponse,
  AnnualLeaveRequestStatus,
  ReviewAnnualLeaveRequestPayload,
} from '@/types/annualLeaveRequest'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/annual-leave-requests/`

type ApiErrorPayload = {
  detail?: string | null
}

export function getClientAnnualLeaveRequestErrorMessage(error: unknown) {
  const axiosError = error as AxiosError<ApiErrorPayload>
  const status = axiosError?.response?.status
  const detail = axiosError?.response?.data?.detail

  if (status === 400) return detail || '처리할 수 없는 요청입니다.'
  if (status === 401) return '로그인이 만료되었습니다.'
  if (status === 403) return '권한이 없습니다.'
  if (status === 404) return detail || '휴가 신청 내역을 찾을 수 없습니다.'
  return detail || '휴가 신청 처리 중 오류가 발생했습니다.'
}

export async function fetchClientAnnualLeaveRequests(params: {
  status?: AnnualLeaveRequestStatus | ''
  admin_id?: number
  offset?: number
  limit?: number
}): Promise<AnnualLeaveRequestListResponse> {
  const res = await clientHttp.get<AnnualLeaveRequestListResponse>(BASE, {
    params: {
      status: params.status || undefined,
      admin_id: params.admin_id,
      offset: params.offset ?? 0,
      limit: params.limit ?? 20,
    },
  })
  return res.data
}

export async function reviewClientAnnualLeaveRequest(
  requestId: number,
  payload: ReviewAnnualLeaveRequestPayload
): Promise<AnnualLeaveRequest> {
  const res = await clientHttp.patch<AnnualLeaveRequest>(`${BASE}${requestId}/review`, payload)
  return res.data
}
