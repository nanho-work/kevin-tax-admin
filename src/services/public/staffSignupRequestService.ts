import axios from 'axios'
import type {
  CreateStaffSignupRequestPayload,
  StaffSignupCompanyLookup,
  StaffSignupConsentTerm,
  StaffSignupRequest,
} from '@/types/staffSignupRequest'
import { getApiErrorMessageFromDetail } from '@/utils/apiError'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/staff/signup-requests/`

export function getStaffSignupRequestErrorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) return '가입 신청 중 오류가 발생했습니다.'
  const status = error.response?.status
  const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail

  if (status === 400) return getApiErrorMessageFromDetail(detail, '입력값을 확인해 주세요.')
  if (status === 404) return getApiErrorMessageFromDetail(detail, '유효한 회사 정보를 찾을 수 없습니다.')
  if (status === 422) return getApiErrorMessageFromDetail(detail, '요청 형식을 확인해 주세요.')
  return getApiErrorMessageFromDetail(detail, '가입 신청 중 오류가 발생했습니다.')
}

export async function createStaffSignupRequest(payload: CreateStaffSignupRequestPayload): Promise<StaffSignupRequest> {
  const res = await axios.post<StaffSignupRequest>(BASE, payload, {
    withCredentials: false,
  })
  return res.data
}

export async function getCompanyByBusinessNumber(businessNumber: string): Promise<StaffSignupCompanyLookup> {
  const res = await axios.get<StaffSignupCompanyLookup>(`${BASE}company-by-business-number`, {
    params: { business_number: businessNumber },
    withCredentials: false,
  })
  return res.data
}

export async function getStaffSignupConsentTerm(): Promise<StaffSignupConsentTerm> {
  const res = await axios.get<StaffSignupConsentTerm>(`${BASE}consent-term`, {
    withCredentials: false,
  })
  return res.data
}
