import http, { getAdminAccessToken } from '@/services/http'
import type {
  AnnualLeaveRequest,
  AnnualLeaveRequestListResponse,
  AnnualLeaveRequestStatus,
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
  offset?: number
  limit?: number
}): Promise<AnnualLeaveRequestListResponse> {
  const res = await http.get(BASE, {
    params: {
      status: params.status || undefined,
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
