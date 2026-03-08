import axios, { type AxiosError } from 'axios'
import type { CreateStaffSignupRequestPayload, StaffSignupRequest } from '@/types/staffSignupRequest'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/staff/signup-requests/`

type ApiErrorPayload = {
  detail?: string | null
}

export function getStaffSignupRequestErrorMessage(error: unknown) {
  const axiosError = error as AxiosError<ApiErrorPayload>
  const status = axiosError?.response?.status
  const detail = axiosError?.response?.data?.detail

  if (status === 400) return detail || '입력값을 확인해 주세요.'
  if (status === 404) return detail || '유효한 회사 정보를 찾을 수 없습니다.'
  return detail || '가입 신청 중 오류가 발생했습니다.'
}

export async function createStaffSignupRequest(payload: CreateStaffSignupRequestPayload): Promise<StaffSignupRequest> {
  const res = await axios.post<StaffSignupRequest>(BASE, payload, {
    withCredentials: false,
  })
  return res.data
}
