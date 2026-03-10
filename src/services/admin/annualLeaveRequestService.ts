import http, { getAdminAccessToken } from '@/services/http'
import type {
  AnnualLeaveRequest,
  AnnualLeaveCancelStatus,
  AnnualLeaveRequestListResponse,
  AnnualLeaveRequestStatus,
  CancelAnnualLeaveRequestPayload,
  CreateAnnualLeaveRequestPayload,
} from '@/types/annualLeaveRequest'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/annual-leave-requests/`

function authHeader() {
  const token = getAdminAccessToken()
  return {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }
}

export async function createAnnualLeaveRequest(payload: CreateAnnualLeaveRequestPayload): Promise<AnnualLeaveRequest> {
  const res = await http.post(BASE, payload, authHeader())
  return res.data
}

export async function fetchMyAnnualLeaveRequests(params: {
  status?: AnnualLeaveRequestStatus | ''
  cancel_status?: AnnualLeaveCancelStatus | ''
  offset?: number
  limit?: number
}): Promise<AnnualLeaveRequestListResponse> {
  const res = await http.get(BASE, {
    params: {
      status: params.status || undefined,
      cancel_status: params.cancel_status || undefined,
      offset: params.offset ?? 0,
      limit: params.limit ?? 20,
    },
    ...authHeader(),
  })
  return res.data
}

export async function cancelAnnualLeaveRequest(requestId: number): Promise<AnnualLeaveRequest> {
  const res = await http.patch(`${BASE}${requestId}/cancel`, {}, authHeader())
  return res.data
}

export async function requestCancelAnnualLeaveRequest(
  requestId: number,
  payload: CancelAnnualLeaveRequestPayload
): Promise<AnnualLeaveRequest> {
  const res = await http.patch(`${BASE}${requestId}/cancel-request`, payload, authHeader())
  return res.data
}
