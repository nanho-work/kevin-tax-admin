import axios from 'axios'
import { clientHttp } from '@/services/http'
import type {
  ClientConsentTerm,
  ClientConsentTermCreatePayload,
  ClientConsentTermListParams,
  ClientConsentTermListResponse,
  ClientConsentTermUpdatePayload,
} from '@/types/clientConsentTerm'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/consent-terms`

export function getClientConsentTermErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const detail = (error.response?.data as any)?.detail
    if (typeof detail === 'string' && detail.trim()) return detail.trim()
    if (status === 400) return '요청값을 확인해 주세요.'
    if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
    if (status === 403) return '권한이 없습니다.'
    if (status === 404) return '동의 약관을 찾을 수 없습니다.'
    if (status === 409) return '동일 code/version 약관이 이미 존재합니다.'
    if (status === 422) return '입력값 형식을 확인해 주세요.'
    if (typeof status === 'number' && status >= 500) return '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  }
  return '동의 약관 처리 중 오류가 발생했습니다.'
}

export async function listClientConsentTerms(
  params: ClientConsentTermListParams = {}
): Promise<ClientConsentTermListResponse> {
  const res = await clientHttp.get<ClientConsentTermListResponse>(`${BASE}/`, { params })
  return res.data
}

export async function getClientConsentTerm(termId: number): Promise<ClientConsentTerm> {
  const res = await clientHttp.get<ClientConsentTerm>(`${BASE}/${termId}`)
  return res.data
}

export async function createClientConsentTerm(payload: ClientConsentTermCreatePayload): Promise<ClientConsentTerm> {
  const res = await clientHttp.post<ClientConsentTerm>(`${BASE}/`, payload)
  return res.data
}

export async function updateClientConsentTerm(
  termId: number,
  payload: ClientConsentTermUpdatePayload
): Promise<ClientConsentTerm> {
  const res = await clientHttp.patch<ClientConsentTerm>(`${BASE}/${termId}`, payload)
  return res.data
}
