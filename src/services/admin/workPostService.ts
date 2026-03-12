import axios from 'axios'
import { adminHttp } from '@/services/http'
import type {
  WorkPostActionResponse,
  WorkPostDetail,
  WorkPostInboxListResponse,
  WorkPostReceiptStatus,
  WorkPostType,
} from '@/types/workPost'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/work-posts`

export function getAdminWorkPostErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const detail = (error.response?.data as any)?.detail
    const detailText = typeof detail === 'string' ? detail : ''

    if (status === 400) return detailText || '요청 값을 확인해 주세요.'
    if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
    if (status === 403) return detailText || '권한이 없습니다.'
    if (status === 404) return detailText || '게시글을 찾을 수 없습니다.'
    if (status === 422) return detailText || '입력 값을 확인해 주세요.'
    if (typeof status === 'number' && status >= 500) return '게시글 처리 중 오류가 발생했습니다.'
    return detailText || '게시글 처리 중 오류가 발생했습니다.'
  }
  return '게시글 처리 중 오류가 발생했습니다.'
}

export async function fetchAdminWorkPostInbox(params?: {
  page?: number
  size?: number
  status?: WorkPostReceiptStatus | ''
  post_type?: WorkPostType | ''
}): Promise<WorkPostInboxListResponse> {
  const res = await adminHttp.get<WorkPostInboxListResponse>(`${BASE}/inbox`, {
    params: {
      page: params?.page ?? 1,
      size: params?.size ?? 20,
      status: params?.status || undefined,
      post_type: params?.post_type || undefined,
    },
  })
  return res.data
}

export async function fetchAdminWorkPostDetail(postId: number): Promise<WorkPostDetail> {
  const res = await adminHttp.get<WorkPostDetail>(`${BASE}/${postId}`)
  return res.data
}

export async function updateAdminWorkPostReceiptStatus(
  postId: number,
  status: Exclude<WorkPostReceiptStatus, 'unread'>
): Promise<WorkPostActionResponse> {
  const res = await adminHttp.patch<WorkPostActionResponse>(`${BASE}/${postId}/receipt/status`, {
    status,
  })
  return res.data
}

export async function setAdminWorkPostHidden(
  postId: number,
  isHidden: boolean
): Promise<WorkPostActionResponse> {
  const res = await adminHttp.patch<WorkPostActionResponse>(`${BASE}/${postId}/receipt/hide`, {
    is_hidden: isHidden,
  })
  return res.data
}

