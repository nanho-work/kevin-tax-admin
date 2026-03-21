import axios from 'axios'
import { adminHttp } from '@/services/http'
import { createMultipartUploadAdapter, uploadViaAdapter } from '@/services/upload/multipartUpload'
import type {
  DocsDownloadBulkPayload,
  DocsDownloadBulkResponse,
  DocsEntry,
  DocsEntryDownloadUrlResponse,
  DocsEntryPreviewUrlResponse,
  DocsEntryListResponse,
  DocsEntryMovePayload,
  DocsEntryRenamePayload,
  DocsEntryUploadCompletePayload,
  DocsEntryUploadMultipartPayload,
  DocsEntryUploadUrlPayload,
  DocsEntryUploadUrlResponse,
  DocsFolder,
  DocsFolderCreatePayload,
  DocsFolderRenamePayload,
  DocsFolderTreeResponse,
  DocsMessageResponse,
  DocsMoveBulkPayload,
  DocsMoveBulkResponse,
  DocsSortBy,
  DocsSortOrder,
  DocsStorageUsageResponse,
  DocsTrashCountResponse,
  DocsTrashBulkPayload,
  DocsTrashDeleteBulkResponse,
  DocsTrashEntryListResponse,
  DocsTrashRestoreBulkResponse,
  DocsViewMode,
} from '@/types/adminDocs'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/docs`

const uploadAdminDocsEntryMultipartAdapter = createMultipartUploadAdapter<
  DocsEntry,
  DocsEntryUploadMultipartPayload
>({
  url: () => `${BASE}/entries/upload`,
  buildFields: (context) => ({
    folder_id: context.folder_id,
  }),
})

type ApiDetailObject = {
  code?: string
  message?: string
  quota_bytes?: number
  used_total_bytes?: number
  incoming_size_bytes?: number
  available_bytes?: number
}

type ApiErrorPayload = {
  detail?: string | ApiDetailObject | null
}

export function getAdminDocsErrorCode(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null
  const detail = (error.response?.data as ApiErrorPayload | undefined)?.detail
  if (detail && typeof detail === 'object' && typeof detail.code === 'string') {
    return detail.code
  }
  return null
}

export function getAdminDocsErrorDetail(error: unknown): ApiDetailObject | null {
  if (!axios.isAxiosError(error)) return null
  const detail = (error.response?.data as ApiErrorPayload | undefined)?.detail
  if (detail && typeof detail === 'object') {
    return detail
  }
  return null
}

export function getAdminDocsErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return '문서함 처리 중 오류가 발생했습니다.'
  const status = error.response?.status
  const detail = (error.response?.data as ApiErrorPayload | undefined)?.detail

  if (typeof detail === 'string' && detail.trim()) return detail
  if (detail && typeof detail === 'object' && typeof detail.message === 'string' && detail.message.trim()) {
    return detail.message
  }

  if (status === 400) return '요청 값을 확인해 주세요.'
  if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
  if (status === 403) return '권한이 없습니다.'
  if (status === 404) return '대상을 찾을 수 없습니다.'
  if (status === 409) return '현재 요청을 처리할 수 없습니다.'
  if (status === 422) return '입력 값을 확인해 주세요.'
  if (typeof status === 'number' && status >= 500) return '문서함 처리 중 서버 오류가 발생했습니다.'
  return '문서함 처리 중 오류가 발생했습니다.'
}

export async function fetchAdminDocsFolderTree(): Promise<DocsFolderTreeResponse> {
  const res = await adminHttp.get<DocsFolderTreeResponse>(`${BASE}/folders/tree`)
  return res.data
}

export async function createAdminDocsFolder(payload: DocsFolderCreatePayload): Promise<DocsFolder> {
  const res = await adminHttp.post<DocsFolder>(`${BASE}/folders`, payload)
  return res.data
}

export async function renameAdminDocsFolder(folderId: number, payload: DocsFolderRenamePayload): Promise<DocsFolder> {
  const res = await adminHttp.patch<DocsFolder>(`${BASE}/folders/${folderId}`, payload)
  return res.data
}

export async function deleteAdminDocsFolder(folderId: number): Promise<DocsMessageResponse> {
  const res = await adminHttp.delete<DocsMessageResponse>(`${BASE}/folders/${folderId}`)
  return res.data
}

export async function fetchAdminDocsFolderEntries(params: {
  folderId: number
  view: DocsViewMode
  sortBy?: DocsSortBy
  order?: DocsSortOrder
}): Promise<DocsEntryListResponse> {
  const res = await adminHttp.get<DocsEntryListResponse>(`${BASE}/folders/${params.folderId}/entries`, {
    params: {
      view: params.view,
      sort_by: params.sortBy,
      order: params.order,
    },
  })
  return res.data
}

export async function moveAdminDocsEntry(entryId: number, payload: DocsEntryMovePayload): Promise<DocsEntry> {
  const res = await adminHttp.patch<DocsEntry>(`${BASE}/entries/${entryId}/move`, payload)
  return res.data
}

export async function uploadAdminDocsEntryMultipart(payload: DocsEntryUploadMultipartPayload): Promise<DocsEntry> {
  return uploadViaAdapter(adminHttp, uploadAdminDocsEntryMultipartAdapter, payload)
}

export async function issueAdminDocsEntryUploadUrl(payload: DocsEntryUploadUrlPayload): Promise<DocsEntryUploadUrlResponse> {
  const res = await adminHttp.post<DocsEntryUploadUrlResponse>(`${BASE}/entries/upload-url`, payload)
  return res.data
}

export async function uploadFileToPresignedUrl(
  uploadUrl: string,
  file: File,
  contentType?: string | null,
  timeoutMs = 30000
): Promise<void> {
  await axios.put(uploadUrl, file, {
    headers: {
      'Content-Type': contentType || file.type || 'application/octet-stream',
    },
    timeout: timeoutMs,
  })
}

export async function completeAdminDocsEntryUpload(payload: DocsEntryUploadCompletePayload): Promise<DocsEntry> {
  const res = await adminHttp.post<DocsEntry>(`${BASE}/entries/upload-complete`, payload)
  return res.data
}

export async function fetchAdminDocsEntryDownloadUrl(entryId: number, expiresIn = 600): Promise<DocsEntryDownloadUrlResponse> {
  const res = await adminHttp.get<DocsEntryDownloadUrlResponse>(`${BASE}/entries/${entryId}/download-url`, {
    params: { expires_in: expiresIn },
  })
  return res.data
}

export async function fetchAdminDocsEntryPreviewUrl(entryId: number, expiresIn = 600): Promise<DocsEntryPreviewUrlResponse> {
  const res = await adminHttp.get<DocsEntryPreviewUrlResponse>(`${BASE}/entries/${entryId}/preview-url`, {
    params: { expires_in: expiresIn },
  })
  return res.data
}

export async function renameAdminDocsEntry(entryId: number, payload: DocsEntryRenamePayload): Promise<DocsEntry> {
  const res = await adminHttp.patch<DocsEntry>(`${BASE}/entries/${entryId}`, payload)
  return res.data
}

export async function deleteAdminDocsEntry(entryId: number): Promise<DocsMessageResponse> {
  const res = await adminHttp.delete<DocsMessageResponse>(`${BASE}/entries/${entryId}`)
  return res.data
}

export async function moveAdminDocsEntriesBulk(payload: DocsMoveBulkPayload): Promise<DocsMoveBulkResponse> {
  const res = await adminHttp.post<DocsMoveBulkResponse>(`${BASE}/move-bulk`, payload)
  return res.data
}

function parseFilenameFromDisposition(disposition: string | undefined, fallback: string): string {
  if (!disposition) return fallback
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/["']/g, ''))
    } catch {
      return utf8Match[1]
    }
  }
  const plainMatch = disposition.match(/filename="?([^"]+)"?/i)
  if (plainMatch?.[1]) return plainMatch[1]
  return fallback
}

export async function downloadAdminDocsEntriesBulk(payload: DocsDownloadBulkPayload): Promise<DocsDownloadBulkResponse> {
  const res = await adminHttp.post(`${BASE}/download-bulk`, payload, {
    responseType: 'blob',
  })
  const disposition = res.headers['content-disposition'] as string | undefined
  const filename = parseFilenameFromDisposition(disposition, `docs_bulk_${Date.now()}.zip`)
  return {
    blob: res.data as Blob,
    filename,
  }
}

export async function fetchAdminDocsTrashEntries(params?: {
  page?: number
  size?: number
  q?: string
}): Promise<DocsTrashEntryListResponse> {
  const res = await adminHttp.get<DocsTrashEntryListResponse>(`${BASE}/trash/entries`, {
    params: {
      page: params?.page ?? 1,
      size: params?.size ?? 50,
      q: params?.q,
    },
  })
  return res.data
}

export async function fetchAdminDocsTrashCount(q?: string): Promise<DocsTrashCountResponse> {
  const res = await adminHttp.get<DocsTrashCountResponse>(`${BASE}/trash/count`, {
    params: { q },
  })
  return res.data
}

export async function fetchAdminDocsStorageUsage(): Promise<DocsStorageUsageResponse> {
  const res = await adminHttp.get<DocsStorageUsageResponse>(`${BASE}/storage/usage`)
  return res.data
}

export async function restoreAdminDocsTrashEntry(entryId: number): Promise<DocsEntry> {
  const res = await adminHttp.post<DocsEntry>(`${BASE}/trash/entries/${entryId}/restore`)
  return res.data
}

export async function purgeAdminDocsTrashEntry(entryId: number): Promise<DocsMessageResponse> {
  const res = await adminHttp.delete<DocsMessageResponse>(`${BASE}/trash/entries/${entryId}`)
  return res.data
}

export async function restoreAdminDocsTrashEntriesBulk(
  payload: DocsTrashBulkPayload
): Promise<DocsTrashRestoreBulkResponse> {
  const res = await adminHttp.post<DocsTrashRestoreBulkResponse>(`${BASE}/trash/restore-bulk`, payload)
  return res.data
}

export async function purgeAdminDocsTrashEntriesBulk(
  payload: DocsTrashBulkPayload
): Promise<DocsTrashDeleteBulkResponse> {
  const res = await adminHttp.post<DocsTrashDeleteBulkResponse>(`${BASE}/trash/delete-bulk`, payload)
  return res.data
}
