import axios from 'axios'
import { adminHttp } from '@/services/http'
import type {
  AdminSheetDocument,
  AdminSheetColumnWidthsPatchPayload,
  AdminSheetColumnsPatchPayload,
  AdminSheetCreateFromDocResponse,
  AdminSheetDetailResponse,
  AdminSheetExportResponse,
  AdminSheetListResponse,
  AdminSheetLock,
  AdminSheetLockAcquirePayload,
  AdminSheetLockHeartbeatPayload,
  AdminSheetRowLock,
  AdminSheetRowLockAcquirePayload,
  AdminSheetRowLockHeartbeatPayload,
  AdminSheetMessageResponse,
  AdminSheetRow,
  AdminSheetRowsPageResponse,
  AdminSheetRowCreatePayload,
  AdminSheetRowPatchPayload,
  AdminSheetStylesPatchPayload,
  AdminSheetStylesPatchResponse,
} from '@/types/adminSheets'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/sheets`

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

type ApiErrorPayload = {
  detail?: string | { code?: string; message?: string } | null
}

export function getAdminSheetsErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return '시트 처리 중 오류가 발생했습니다.'
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
  if (status === 409) return '다른 사용자가 편집 중이거나 잠금이 만료되었습니다.'
  if (status === 422) return '입력 값을 확인해 주세요.'
  if (typeof status === 'number' && status >= 500) return '시트 처리 중 서버 오류가 발생했습니다.'
  return '시트 처리 중 오류가 발생했습니다.'
}

export async function fetchAdminSheets(params?: {
  page?: number
  size?: number
  keyword?: string
}): Promise<AdminSheetListResponse> {
  const res = await adminHttp.get<AdminSheetListResponse>(`${BASE}`, {
    params: {
      page: params?.page ?? 1,
      size: params?.size ?? 20,
      keyword: params?.keyword || undefined,
    },
  })
  return res.data
}

export async function createAdminSheetFromDocEntry(
  entryId: number,
  options?: { forceNew?: boolean }
): Promise<AdminSheetCreateFromDocResponse> {
  const res = await adminHttp.post<AdminSheetCreateFromDocResponse>(
    `${BASE}/from-doc-entry/${entryId}`,
    undefined,
    {
      params: {
        force_new: options?.forceNew ? true : undefined,
      },
    }
  )
  return res.data
}

export async function fetchAdminSheetDetail(sheetId: number, limitRows = 200): Promise<AdminSheetDetailResponse> {
  const res = await adminHttp.get<AdminSheetDetailResponse>(`${BASE}/${sheetId}`, {
    params: { limit_rows: limitRows },
  })
  return res.data
}

export async function fetchAdminSheetRows(
  sheetId: number,
  params?: { offset?: number; limit?: number }
): Promise<AdminSheetRowsPageResponse> {
  const res = await adminHttp.get<AdminSheetRowsPageResponse>(`${BASE}/${sheetId}/rows`, {
    params: {
      offset: params?.offset ?? 0,
      limit: params?.limit ?? 200,
    },
  })
  return res.data
}

export async function acquireAdminSheetLock(
  sheetId: number,
  payload?: AdminSheetLockAcquirePayload
): Promise<AdminSheetLock> {
  const res = await adminHttp.post<AdminSheetLock>(`${BASE}/${sheetId}/lock`, {
    ttl_seconds: payload?.ttl_seconds ?? 30,
  })
  return res.data
}

export async function heartbeatAdminSheetLock(
  sheetId: number,
  payload: AdminSheetLockHeartbeatPayload
): Promise<AdminSheetLock> {
  const res = await adminHttp.post<AdminSheetLock>(`${BASE}/${sheetId}/lock/heartbeat`, {
    lock_token: payload.lock_token,
    ttl_seconds: payload.ttl_seconds ?? 30,
  })
  return res.data
}

export async function releaseAdminSheetLock(sheetId: number): Promise<AdminSheetLock> {
  const res = await adminHttp.delete<AdminSheetLock>(`${BASE}/${sheetId}/lock`)
  return res.data
}

export async function acquireAdminSheetRowLock(
  sheetId: number,
  rowId: number,
  payload?: AdminSheetRowLockAcquirePayload
): Promise<AdminSheetRowLock> {
  const res = await adminHttp.post<AdminSheetRowLock>(`${BASE}/${sheetId}/rows/${rowId}/lock`, {
    ttl_seconds: payload?.ttl_seconds ?? 30,
  })
  return res.data
}

export async function heartbeatAdminSheetRowLock(
  sheetId: number,
  rowId: number,
  payload: AdminSheetRowLockHeartbeatPayload
): Promise<AdminSheetRowLock> {
  const res = await adminHttp.post<AdminSheetRowLock>(`${BASE}/${sheetId}/rows/${rowId}/lock/heartbeat`, {
    lock_token: payload.lock_token,
    ttl_seconds: payload.ttl_seconds ?? 30,
  })
  return res.data
}

export async function releaseAdminSheetRowLock(sheetId: number, rowId: number): Promise<AdminSheetRowLock> {
  const res = await adminHttp.delete<AdminSheetRowLock>(`${BASE}/${sheetId}/rows/${rowId}/lock`)
  return res.data
}

export async function patchAdminSheetRow(
  sheetId: number,
  rowId: number,
  payload: AdminSheetRowPatchPayload,
  lockToken?: string | null
): Promise<AdminSheetRow> {
  const res = await adminHttp.patch<AdminSheetRow>(`${BASE}/${sheetId}/rows/${rowId}`, payload, {
    params: { lock_token: lockToken || undefined },
  })
  return res.data
}

export async function createAdminSheetRow(
  sheetId: number,
  payload: AdminSheetRowCreatePayload,
  lockToken?: string | null
): Promise<AdminSheetRow> {
  const res = await adminHttp.post<AdminSheetRow>(`${BASE}/${sheetId}/rows`, payload, {
    params: { lock_token: lockToken || undefined },
  })
  return res.data
}

export async function deleteAdminSheetRow(
  sheetId: number,
  rowId: number,
  lockToken?: string | null
): Promise<AdminSheetMessageResponse> {
  const res = await adminHttp.delete<AdminSheetMessageResponse>(`${BASE}/${sheetId}/rows/${rowId}`, {
    params: { lock_token: lockToken || undefined },
  })
  return res.data
}

export async function patchAdminSheetColumns(
  sheetId: number,
  payload: AdminSheetColumnsPatchPayload,
  lockToken: string
): Promise<AdminSheetMessageResponse> {
  const res = await adminHttp.patch<AdminSheetMessageResponse>(`${BASE}/${sheetId}/columns`, payload, {
    params: { lock_token: lockToken },
  })
  return res.data
}

export async function patchAdminSheetStyles(
  sheetId: number,
  payload: AdminSheetStylesPatchPayload,
  lockToken: string
): Promise<AdminSheetStylesPatchResponse> {
  const res = await adminHttp.patch<AdminSheetStylesPatchResponse>(`${BASE}/${sheetId}/styles`, payload, {
    params: { lock_token: lockToken },
  })
  return res.data
}

export async function patchAdminSheetColumnWidths(
  sheetId: number,
  payload: AdminSheetColumnWidthsPatchPayload,
  lockToken: string
): Promise<AdminSheetDocument> {
  const res = await adminHttp.patch<AdminSheetDocument>(`${BASE}/${sheetId}/column-widths`, payload, {
    params: { lock_token: lockToken },
  })
  return res.data
}

export async function exportAdminSheetXlsx(sheetId: number): Promise<AdminSheetExportResponse> {
  const res = await adminHttp.get(`${BASE}/${sheetId}/export`, {
    responseType: 'blob',
  })
  const disposition = res.headers['content-disposition'] as string | undefined
  const filename = parseFilenameFromDisposition(disposition, `sheet_${sheetId}.xlsx`)
  return {
    blob: res.data as Blob,
    filename,
  }
}
