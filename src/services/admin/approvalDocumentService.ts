import type { AxiosError } from 'axios'
import http, { getAdminAccessToken } from '@/services/http'
import type {
  ApprovalAttachmentAction,
  ApprovalAttachment,
  ApprovalAttachmentDownloadResponse,
  ApprovalDocument,
  ApprovalDocumentDetail,
  ApprovalDocumentListResponse,
  ApprovalDocumentStatus,
  CreateApprovalDocumentPayload,
  ReviewApprovalDocumentPayload,
} from '@/types/approvalDocument'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/approvals/documents/`

type ApiErrorPayload = {
  detail?: string | null
}

function authHeader() {
  const token = getAdminAccessToken()
  return {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }
}

export function getApprovalDocumentErrorMessage(error: unknown) {
  const axiosError = error as AxiosError<ApiErrorPayload>
  const status = axiosError?.response?.status
  const detail = axiosError?.response?.data?.detail

  if (status === 400) return detail || '처리할 수 없는 요청입니다.'
  if (status === 401) return '로그인이 만료되었습니다.'
  if (status === 403) return detail || '현재 결재 단계의 결재자가 아닙니다.'
  if (status === 404) return detail || '문서를 찾을 수 없습니다.'
  if (status === 409) return detail || '승인 완료 문서는 수정할 수 없습니다.'
  if (status === 422) return detail || '결재선 입력값을 확인해 주세요.'
  return detail || '결재 문서 처리 중 오류가 발생했습니다.'
}

export async function createApprovalDocument(payload: CreateApprovalDocumentPayload): Promise<ApprovalDocument> {
  const res = await http.post<ApprovalDocument>(BASE, payload, authHeader())
  return res.data
}

export async function fetchMyApprovalDocuments(params: {
  status?: ApprovalDocumentStatus | ''
  only_my_pending?: boolean
  offset?: number
  limit?: number
}): Promise<ApprovalDocumentListResponse> {
  const res = await http.get<ApprovalDocumentListResponse>(BASE, {
    params: {
      status: params.status || undefined,
      only_my_pending: params.only_my_pending ?? undefined,
      offset: params.offset ?? 0,
      limit: params.limit ?? 20,
    },
    ...authHeader(),
  })
  return res.data
}

export async function fetchApprovalDocumentDetail(documentId: number): Promise<ApprovalDocumentDetail> {
  const res = await http.get<ApprovalDocumentDetail>(`${BASE}${documentId}`, authHeader())
  return res.data
}

export async function cancelApprovalDocument(documentId: number): Promise<ApprovalDocument> {
  const res = await http.patch<ApprovalDocument>(`${BASE}${documentId}/cancel`, {}, authHeader())
  return res.data
}

export async function reviewApprovalDocument(
  documentId: number,
  payload: ReviewApprovalDocumentPayload
): Promise<ApprovalDocument> {
  const res = await http.patch<ApprovalDocument>(`${BASE}${documentId}/review`, payload, authHeader())
  return res.data
}

export async function uploadApprovalDocumentAttachment(documentId: number, file: File): Promise<ApprovalAttachment> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await http.post<ApprovalAttachment>(`${BASE}${documentId}/attachments`, formData, {
    ...authHeader(),
    headers: {
      ...authHeader().headers,
      'Content-Type': 'multipart/form-data',
    },
  })
  return res.data
}

export async function getApprovalDocumentAttachmentDownloadUrl(
  documentId: number,
  attachmentId: number,
  action: ApprovalAttachmentAction = 'download'
): Promise<ApprovalAttachmentDownloadResponse> {
  const res = await http.get<ApprovalAttachmentDownloadResponse>(
    `${BASE}${documentId}/attachments/${attachmentId}/download-url`,
    {
      ...authHeader(),
      params: { action },
    }
  )
  return res.data
}
