import type { AxiosError } from 'axios'
import http, { getAdminAccessToken } from '@/services/http'
import type {
  AdminSensitiveConsentTerm,
  AdminSensitiveProfile,
  AdminSensitiveProfileUpsertPayload,
  AdminSensitiveRevealPayload,
  AdminSensitiveRevealResponse,
} from '@/types/adminSensitiveProfile'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/me/sensitive-profile`

type ApiErrorPayload = {
  detail?: string | null
}

function authHeader() {
  const token = getAdminAccessToken()
  return {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }
}

export function getAdminSensitiveProfileErrorMessage(error: unknown) {
  const axiosError = error as AxiosError<ApiErrorPayload>
  const status = axiosError?.response?.status
  const detail = axiosError?.response?.data?.detail

  if (status === 400) return detail || '입력값을 확인해 주세요.'
  if (status === 401) return '로그인이 만료되었습니다.'
  if (status === 403) return '권한이 없습니다.'
  if (status === 404) return detail || '민감정보가 없습니다.'
  return detail || '민감정보 처리 중 오류가 발생했습니다.'
}

export async function fetchMySensitiveProfile(): Promise<AdminSensitiveProfile> {
  const res = await http.get<AdminSensitiveProfile>(BASE, authHeader())
  return res.data
}

export async function upsertMySensitiveProfile(payload: AdminSensitiveProfileUpsertPayload): Promise<AdminSensitiveProfile> {
  const res = await http.put<AdminSensitiveProfile>(BASE, payload, authHeader())
  return res.data
}

export async function revealMySensitiveProfile(payload: AdminSensitiveRevealPayload): Promise<AdminSensitiveRevealResponse> {
  const res = await http.post<AdminSensitiveRevealResponse>(`${BASE}/reveal`, payload, authHeader())
  return res.data
}

export async function fetchMySensitiveConsentTerms(): Promise<AdminSensitiveConsentTerm[]> {
  const res = await http.get(`${BASE}/consent-terms`, authHeader())
  const data = res.data as
    | AdminSensitiveConsentTerm[]
    | { items?: AdminSensitiveConsentTerm[]; terms?: AdminSensitiveConsentTerm[] }
    | null
    | undefined

  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.terms)) return data.terms
  return []
}
