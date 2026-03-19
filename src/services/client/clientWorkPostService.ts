import axios from 'axios'
import { clientHttp } from '@/services/http'
import { createMultipartUploadAdapter, uploadViaAdapter } from '@/services/upload/multipartUpload'
import type {
  WorkPostActionResponse,
  WorkPostAttachment,
  WorkPostAttachmentListResponse,
  WorkPostCreatePayload,
  WorkPostDetail,
  WorkPostListResponse,
  WorkPostReceiptListResponse,
  WorkPostStatus,
  WorkPostType,
  WorkPostUpdatePayload,
} from '@/types/workPost'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/work-posts`
const uploadClientWorkPostAttachmentAdapter = createMultipartUploadAdapter<
  WorkPostAttachment,
  { file: File; postId: number }
>({
  url: ({ postId }) => `${BASE}/${postId}/attachments`,
})

export function getClientWorkPostErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const detail = (error.response?.data as any)?.detail
    const detailText = typeof detail === 'string' ? detail : ''

    if (status === 400) return detailText || '요청 값을 확인해 주세요.'
    if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
    if (status === 403) return detailText || '권한이 없습니다.'
    if (status === 404) return detailText || '게시글을 찾을 수 없습니다.'
    if (status === 409) return detailText || '현재 상태에서 처리할 수 없습니다.'
    if (status === 422) return detailText || '입력 값을 확인해 주세요.'
    if (typeof status === 'number' && status >= 500) return '게시글 처리 중 오류가 발생했습니다.'
    return detailText || '게시글 처리 중 오류가 발생했습니다.'
  }
  return '게시글 처리 중 오류가 발생했습니다.'
}

export async function createClientWorkPost(payload: WorkPostCreatePayload): Promise<WorkPostDetail> {
  const res = await clientHttp.post<WorkPostDetail>(BASE, payload)
  return res.data
}

export async function fetchClientWorkPosts(params?: {
  page?: number
  size?: number
  post_type?: WorkPostType | ''
  status?: WorkPostStatus | ''
}): Promise<WorkPostListResponse> {
  const res = await clientHttp.get<WorkPostListResponse>(BASE, {
    params: {
      page: params?.page ?? 1,
      size: params?.size ?? 20,
      post_type: params?.post_type || undefined,
      status: params?.status || undefined,
    },
  })
  return res.data
}

export async function fetchClientWorkPostDetail(postId: number): Promise<WorkPostDetail> {
  const res = await clientHttp.get<WorkPostDetail>(`${BASE}/${postId}`)
  return res.data
}

export async function updateClientWorkPost(postId: number, payload: WorkPostUpdatePayload): Promise<WorkPostDetail> {
  const res = await clientHttp.patch<WorkPostDetail>(`${BASE}/${postId}`, payload)
  return res.data
}

export async function deleteClientWorkPost(postId: number): Promise<WorkPostActionResponse> {
  const res = await clientHttp.delete<WorkPostActionResponse>(`${BASE}/${postId}`)
  return res.data
}

export async function fetchClientWorkPostReceipts(
  postId: number,
  params?: { page?: number; size?: number }
): Promise<WorkPostReceiptListResponse> {
  const res = await clientHttp.get<WorkPostReceiptListResponse>(`${BASE}/${postId}/receipts`, {
    params: {
      page: params?.page ?? 1,
      size: params?.size ?? 50,
    },
  })
  return res.data
}

export async function uploadClientWorkPostAttachment(postId: number, file: File): Promise<WorkPostAttachment> {
  return uploadViaAdapter(clientHttp, uploadClientWorkPostAttachmentAdapter, { postId, file })
}

export async function fetchClientWorkPostAttachments(postId: number): Promise<WorkPostAttachmentListResponse> {
  const res = await clientHttp.get<WorkPostAttachmentListResponse>(`${BASE}/${postId}/attachments`)
  return res.data
}

export async function deleteClientWorkPostAttachment(
  postId: number,
  attachmentId: number
): Promise<WorkPostActionResponse> {
  const res = await clientHttp.delete<WorkPostActionResponse>(`${BASE}/${postId}/attachments/${attachmentId}`)
  return res.data
}

export async function hideClientWorkPost(postId: number, isHidden: boolean): Promise<WorkPostActionResponse> {
  const res = await clientHttp.patch<WorkPostActionResponse>(`${BASE}/${postId}/hide`, {
    is_hidden: isHidden,
  })
  return res.data
}
