import type { AxiosError } from 'axios'
import http, { getAdminAccessToken } from '@/services/http'
import { createMultipartUploadAdapter, uploadViaAdapter } from '@/services/upload/multipartUpload'
import type {
  PersonalDocument,
  PersonalDocumentDocType,
  PersonalDocumentListResponse,
  PersonalDocumentStatusResponse,
  PersonalDocumentUrlResponse,
} from '@/types/personalDocument'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/me/personal-documents`

type ApiErrorPayload = {
  detail?: string | null
}

function authHeader() {
  const token = getAdminAccessToken()
  return {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }
}

const uploadMyPersonalDocumentAdapter = createMultipartUploadAdapter<
  PersonalDocument,
  { file: File; docTypeCode: PersonalDocumentDocType }
>({
  url: ({ docTypeCode }) => `${BASE}/${docTypeCode}`,
  requestConfig: () => authHeader(),
})

export function getAdminPersonalDocumentErrorMessage(error: unknown) {
  const axiosError = error as AxiosError<ApiErrorPayload>
  const status = axiosError?.response?.status
  const detail = axiosError?.response?.data?.detail

  if (status === 400) return detail || '입력값을 확인해 주세요.'
  if (status === 401) return '로그인이 만료되었습니다.'
  if (status === 403) return '권한이 없습니다.'
  if (status === 404) return detail || '문서를 찾을 수 없습니다.'
  return detail || '개인문서 처리 중 오류가 발생했습니다.'
}

export async function uploadMyPersonalDocument(docTypeCode: PersonalDocumentDocType, file: File): Promise<PersonalDocument> {
  return uploadViaAdapter(http, uploadMyPersonalDocumentAdapter, { docTypeCode, file })
}

export async function fetchMyPersonalDocuments(): Promise<PersonalDocumentListResponse> {
  const res = await http.get<PersonalDocumentListResponse>(`${BASE}/`, authHeader())
  return res.data
}

export async function fetchMyPersonalDocumentStatus(): Promise<PersonalDocumentStatusResponse> {
  const res = await http.get<PersonalDocumentStatusResponse>(`${BASE}/status`, authHeader())
  return res.data
}

export async function fetchMyPersonalDocumentPreviewUrl(docTypeCode: PersonalDocumentDocType): Promise<PersonalDocumentUrlResponse> {
  const res = await http.get<PersonalDocumentUrlResponse>(`${BASE}/${docTypeCode}/preview-url`, authHeader())
  return res.data
}
