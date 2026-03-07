import type { AxiosError } from 'axios'
import { clientHttp } from '@/services/http'
import type {
  AnnualLeaveAdjustRequest,
  AnnualLeaveAdjustResponse,
  AnnualLeaveAutoGrantResponse,
  AnnualLeaveExpireResponse,
  AnnualLeaveListParams,
  AnnualLeaveResponse,
  AnnualLeaveUseRequest,
  AnnualLeaveUseResponse,
} from '@/types/annualLeave'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/annual-leaves/`

type ApiErrorPayload = {
  detail?: string | null
}

export function getClientAnnualLeaveErrorMessage(error: unknown) {
  const axiosError = error as AxiosError<ApiErrorPayload>
  const status = axiosError?.response?.status
  const detail = axiosError?.response?.data?.detail

  if (status === 400) return detail || '잔여 연차가 부족합니다'
  if (status === 401) return '로그인이 만료되었습니다'
  if (status === 403) return '권한이 없습니다'
  if (status === 404) return detail || '대상 직원이 없습니다'
  return detail || '연차 처리 중 오류가 발생했습니다'
}

export async function fetchClientAnnualLeaves(params: AnnualLeaveListParams = {}) {
  const res = await clientHttp.get<AnnualLeaveResponse>(`${BASE}`, { params })
  return res.data
}

export async function autoGrantClientAnnualLeaves() {
  const res = await clientHttp.post<AnnualLeaveAutoGrantResponse>(`${BASE}/auto-grant`)
  return res.data
}

export async function useClientAnnualLeave(payload: AnnualLeaveUseRequest) {
  const res = await clientHttp.post<AnnualLeaveUseResponse>(`${BASE}/use`, payload)
  return res.data
}

export async function adjustClientAnnualLeave(payload: AnnualLeaveAdjustRequest) {
  const res = await clientHttp.post<AnnualLeaveAdjustResponse>(`${BASE}/adjust`, payload)
  return res.data
}

export async function expireClientAnnualLeaves() {
  const res = await clientHttp.post<AnnualLeaveExpireResponse>(`${BASE}/expire`)
  return res.data
}
