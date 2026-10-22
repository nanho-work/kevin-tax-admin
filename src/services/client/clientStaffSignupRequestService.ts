import axios from 'axios'
import { officeHttp as clientHttp } from '@/services/officeHttp'
import type {
  ApproveStaffSignupRequestPayload,
  RejectStaffSignupRequestPayload,
  StaffSignupRequest,
  StaffSignupRequestListResponse,
  StaffSignupRequestStatus,
} from '@/types/staffSignupRequest'
import { getApiErrorMessageFromDetail } from '@/utils/apiError'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/staff-signup-requests/`

export function getClientStaffSignupRequestErrorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) return '가입 신청 처리 중 오류가 발생했습니다.'
  const status = error.response?.status
  const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail

  if (status === 400) return getApiErrorMessageFromDetail(detail, '요청을 처리할 수 없습니다.')
  if (status === 401) return '로그인이 만료되었습니다.'
  if (status === 403) return '권한이 없습니다.'
  if (status === 404) return getApiErrorMessageFromDetail(detail, '가입 신청을 찾을 수 없습니다.')
  return getApiErrorMessageFromDetail(detail, '가입 신청 처리 중 오류가 발생했습니다.')
}

export async function fetchClientStaffSignupRequests(status?: StaffSignupRequestStatus | ''): Promise<StaffSignupRequestListResponse> {
  const res = await clientHttp.get<StaffSignupRequestListResponse>(BASE, {
    params: {
      status: status || undefined,
    },
  })
  return res.data
}

export async function approveClientStaffSignupRequest(
  requestId: number,
  payload: ApproveStaffSignupRequestPayload
): Promise<StaffSignupRequest> {
  const res = await clientHttp.patch<StaffSignupRequest>(`${BASE}${requestId}/approve`, payload)
  return res.data
}

export async function rejectClientStaffSignupRequest(
  requestId: number,
  payload: RejectStaffSignupRequestPayload
): Promise<StaffSignupRequest> {
  const res = await clientHttp.patch<StaffSignupRequest>(`${BASE}${requestId}/reject`, payload)
  return res.data
}
