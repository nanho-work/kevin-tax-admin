import type { AxiosError } from 'axios'
import { clientHttp } from '@/services/http'
import type {
  PersonalDocumentListResponse,
  PersonalDocumentStatusResponse,
  PersonalDocumentUrlResponse,
} from '@/types/personalDocument'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/staffs`

type ApiErrorPayload = {
  detail?: string | null
}

export function getClientStaffPersonalDocumentErrorMessage(error: unknown) {
  const axiosError = error as AxiosError<ApiErrorPayload>
  const status = axiosError?.response?.status
  const detail = axiosError?.response?.data?.detail

  if (status === 400) return detail || '입력값을 확인해 주세요.'
  if (status === 401) return '로그인이 만료되었습니다.'
  if (status === 403) return '권한이 없습니다.'
  if (status === 404) return detail || '문서를 찾을 수 없습니다.'
  return detail || '개인문서 처리 중 오류가 발생했습니다.'
}

export async function fetchClientStaffPersonalDocuments(adminId: number): Promise<PersonalDocumentListResponse> {
  const res = await clientHttp.get<PersonalDocumentListResponse>(`${BASE}/${adminId}/personal-documents`)
  return res.data
}

export async function fetchClientStaffPersonalDocumentStatus(adminId: number): Promise<PersonalDocumentStatusResponse> {
  const res = await clientHttp.get<PersonalDocumentStatusResponse>(`${BASE}/${adminId}/personal-documents/status`)
  return res.data
}

export async function fetchClientStaffPersonalDocumentPreviewUrl(
  adminId: number,
  documentId: number
): Promise<PersonalDocumentUrlResponse> {
  const res = await clientHttp.get<PersonalDocumentUrlResponse>(`${BASE}/${adminId}/personal-documents/${documentId}/preview-url`)
  return res.data
}

export async function fetchClientStaffPersonalDocumentDownloadUrl(
  adminId: number,
  documentId: number
): Promise<PersonalDocumentUrlResponse> {
  const res = await clientHttp.get<PersonalDocumentUrlResponse>(`${BASE}/${adminId}/personal-documents/${documentId}/download-url`)
  return res.data
}

export async function deleteClientStaffPersonalDocument(adminId: number, documentId: number): Promise<{ message: string }> {
  const res = await clientHttp.delete<{ message: string }>(`${BASE}/${adminId}/personal-documents/${documentId}`)
  return res.data
}
