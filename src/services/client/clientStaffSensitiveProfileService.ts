import type { AxiosError } from 'axios'
import { clientHttp } from '@/services/http'
import type {
  AdminSensitiveAccessLogListResponse,
  AdminSensitiveProfile,
  AdminSensitiveProfileUpsertPayload,
  AdminSensitiveRevealPayload,
  AdminSensitiveRevealResponse,
} from '@/types/adminSensitiveProfile'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/staffs`

type ApiErrorPayload = {
  detail?: string | null
}

export function getClientStaffSensitiveProfileErrorMessage(error: unknown) {
  const axiosError = error as AxiosError<ApiErrorPayload>
  const status = axiosError?.response?.status
  const detail = axiosError?.response?.data?.detail

  if (status === 400) return detail || '입력값을 확인해 주세요.'
  if (status === 401) return '로그인이 만료되었습니다.'
  if (status === 403) return '권한이 없습니다.'
  if (status === 404) return detail || '직원 민감정보를 찾을 수 없습니다.'
  return detail || '직원 민감정보 처리 중 오류가 발생했습니다.'
}

export async function fetchClientStaffSensitiveProfile(adminId: number): Promise<AdminSensitiveProfile> {
  const res = await clientHttp.get<AdminSensitiveProfile>(`${BASE}/${adminId}/sensitive-profile`)
  return res.data
}

export async function upsertClientStaffSensitiveProfile(
  adminId: number,
  payload: AdminSensitiveProfileUpsertPayload
): Promise<AdminSensitiveProfile> {
  const res = await clientHttp.put<AdminSensitiveProfile>(`${BASE}/${adminId}/sensitive-profile`, payload)
  return res.data
}

export async function revealClientStaffSensitiveProfile(
  adminId: number,
  payload: AdminSensitiveRevealPayload
): Promise<AdminSensitiveRevealResponse> {
  const res = await clientHttp.post<AdminSensitiveRevealResponse>(`${BASE}/${adminId}/sensitive-profile/reveal`, payload)
  return res.data
}

export async function fetchClientStaffSensitiveProfileLogs(
  adminId: number,
  limit: number = 50
): Promise<AdminSensitiveAccessLogListResponse> {
  const res = await clientHttp.get<AdminSensitiveAccessLogListResponse>(`${BASE}/${adminId}/sensitive-profile/logs`, {
    params: { limit },
  })
  return res.data
}
