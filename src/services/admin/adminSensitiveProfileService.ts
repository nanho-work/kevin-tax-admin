import axios from 'axios'
import http, { getAdminAccessToken } from '@/services/http'
import { getApiErrorMessageFromDetail } from '@/utils/apiError'
import type {
  AdminSensitiveConsentRecord,
  AdminSensitiveConsentTerm,
  AdminSensitiveProfile,
  AdminSensitiveProfileUpsertPayload,
  AdminSensitiveRevealPayload,
  AdminSensitiveRevealResponse,
} from '@/types/adminSensitiveProfile'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/me/sensitive-profile`

function authHeader() {
  const token = getAdminAccessToken()
  return {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }
}

export function getAdminSensitiveProfileErrorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) return '민감정보 처리 중 오류가 발생했습니다.'
  const status = error.response?.status
  const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail

  if (status === 400) return getApiErrorMessageFromDetail(detail, '입력값을 확인해 주세요.')
  if (status === 401) return '로그인이 만료되었습니다.'
  if (status === 403) return '권한이 없습니다.'
  if (status === 404) return getApiErrorMessageFromDetail(detail, '민감정보가 없습니다.')
  return getApiErrorMessageFromDetail(detail, '민감정보 처리 중 오류가 발생했습니다.')
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

export async function fetchMySensitiveConsents(): Promise<AdminSensitiveConsentRecord[]> {
  const res = await http.get(`${BASE}/consents`, authHeader())
  const data = res.data as
    | AdminSensitiveConsentRecord[]
    | {
        items?: AdminSensitiveConsentRecord[]
        consents?: AdminSensitiveConsentRecord[]
        records?: AdminSensitiveConsentRecord[]
        list?: AdminSensitiveConsentRecord[]
        results?: AdminSensitiveConsentRecord[]
        data?: AdminSensitiveConsentRecord[]
      }
    | null
    | undefined

  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.consents)) return data.consents
  if (Array.isArray(data?.records)) return data.records
  if (Array.isArray(data?.list)) return data.list
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.data)) return data.data
  return []
}
