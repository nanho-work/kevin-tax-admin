import type { AxiosError } from 'axios'
import { clientHttp } from '@/services/http'
import type {
  ApprovalAttachmentAction,
  ApprovalAttachmentDownloadResponse,
  ApprovalDocument,
  ApprovalDocumentDetail,
  ApprovalDocumentListResponse,
  ApprovalDocumentStatus,
  ApprovalDocumentType,
  ReviewApprovalDocumentPayload,
} from '@/types/approvalDocument'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/approvals/documents/`

type ApiErrorPayload = {
  detail?: string | null
}

export function getClientApprovalDocumentErrorMessage(error: unknown) {
  const axiosError = error as AxiosError<ApiErrorPayload>
  const status = axiosError?.response?.status
  const detail = axiosError?.response?.data?.detail

  if (status === 400) return detail || '처리할 수 없는 결재 문서입니다.'
  if (status === 401) return '로그인이 만료되었습니다.'
  if (status === 403) return detail || '현재 결재 단계의 결재자가 아닙니다.'
  if (status === 404) return detail || '문서를 찾을 수 없습니다.'
  if (status === 409) return detail || '승인 완료 문서는 수정할 수 없습니다.'
  if (status === 422) return detail || '결재선 입력값을 확인해 주세요.'
  return detail || '결재 문서 처리 중 오류가 발생했습니다.'
}

export async function fetchClientApprovalDocuments(params: {
  status?: ApprovalDocumentStatus | ''
  doc_type?: ApprovalDocumentType | ''
  writer_admin_id?: number
  only_my_pending?: boolean
  offset?: number
  limit?: number
}): Promise<ApprovalDocumentListResponse> {
  const res = await clientHttp.get<ApprovalDocumentListResponse>(BASE, {
    params: {
      status: params.status || undefined,
      doc_type: params.doc_type || undefined,
      writer_admin_id: params.writer_admin_id,
      only_my_pending: params.only_my_pending ?? undefined,
      offset: params.offset ?? 0,
      limit: params.limit ?? 20,
    },
  })
  return res.data
}

export async function fetchClientApprovalDocumentDetail(documentId: number): Promise<ApprovalDocumentDetail> {
  const res = await clientHttp.get<ApprovalDocumentDetail>(`${BASE}${documentId}`)
  return res.data
}

export async function reviewClientApprovalDocument(
  documentId: number,
  payload: ReviewApprovalDocumentPayload
): Promise<ApprovalDocument> {
  const res = await clientHttp.patch<ApprovalDocument>(`${BASE}${documentId}/review`, payload)
  return res.data
}

export async function getClientApprovalAttachmentDownloadUrl(
  documentId: number,
  attachmentId: number,
  action: ApprovalAttachmentAction = 'download'
): Promise<ApprovalAttachmentDownloadResponse> {
  const res = await clientHttp.get<ApprovalAttachmentDownloadResponse>(
    `${BASE}${documentId}/attachments/${attachmentId}/download-url`,
    {
      params: { action },
    }
  )
  return res.data
}
