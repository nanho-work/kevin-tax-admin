import type { AxiosError } from 'axios'
import { adminHttp, clientHttp } from '@/services/http'

export type TaskBoardScope = 'admin' | 'client'
export type TaskBoardKind = 'all' | 'corporate' | 'individual'
export type TaskBoardStatus = 'open' | 'closed'

export interface TaskBoardListItem {
  company_id: number
  company_name: string
  company_kind: 'corporate' | 'individual' | 'unknown' | string
  assignee_id?: number | null
  assignee_name?: string | null
  board_id?: number | null
  is_excluded: boolean
  progress_percent: number
  total_count: number
  done_count: number
  todo_count: number
  major_tasks: string[]
  note?: string | null
  updated_at?: string | null
}

export interface TaskBoardListResponse {
  total: number
  page: number
  size: number
  items: TaskBoardListItem[]
}

export interface TaskBoardListParams {
  attribution_month: string
  report_month: string
  q?: string
  kind?: TaskBoardKind
  assignee_id?: number
  assignee?: string
  incomplete_only?: boolean
  include_excluded?: boolean
  page?: number
  size?: number
}

export interface TaskBoardOut {
  id: number
  client_id: number
  company_id: number
  attribution_month: string
  report_month: string
  board_status: TaskBoardStatus
  created_at: string
  updated_at: string
}

interface ApiErrorPayload {
  detail?: string | { code?: string; message?: string } | null
}

function getHttp(scope: TaskBoardScope) {
  return scope === 'admin' ? adminHttp : clientHttp
}

function getBase(scope: TaskBoardScope) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || ''
  return `${apiBase}/${scope}/companies`
}

export function getTaskBoardErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<ApiErrorPayload>
  const detail = axiosError.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (detail && typeof detail === 'object') {
    if (typeof detail.message === 'string' && detail.message.trim()) return detail.message
    if (typeof detail.code === 'string' && detail.code.trim()) return detail.code
  }
  const status = axiosError.response?.status
  if (status === 401) return '로그인이 만료되었습니다.'
  if (status === 403) return '권한이 없습니다.'
  if (status === 404) return '요청한 데이터를 찾을 수 없습니다.'
  if (status === 409) return '요청 충돌이 발생했습니다.'
  if (status === 422) return '요청 파라미터를 확인해 주세요.'
  return '업무보드 요청 중 오류가 발생했습니다.'
}

export async function listTaskBoards(
  scope: TaskBoardScope,
  params: TaskBoardListParams
): Promise<TaskBoardListResponse> {
  const http = getHttp(scope)
  const base = getBase(scope)
  const res = await http.get<TaskBoardListResponse>(`${base}/task-boards/list`, { params })
  return res.data
}

export async function patchTaskBoardExclude(
  scope: TaskBoardScope,
  companyId: number,
  boardId: number,
  isExcluded: boolean
): Promise<TaskBoardOut> {
  const http = getHttp(scope)
  const base = getBase(scope)
  const res = await http.patch<TaskBoardOut>(`${base}/${companyId}/task-boards/${boardId}/exclude`, {
    is_excluded: isExcluded,
  })
  return res.data
}

export async function patchTaskBoardExcludeByMonth(
  scope: TaskBoardScope,
  companyId: number,
  payload: { attribution_month: string; report_month: string; is_excluded: boolean }
): Promise<TaskBoardOut> {
  const http = getHttp(scope)
  const base = getBase(scope)
  const res = await http.patch<TaskBoardOut>(`${base}/${companyId}/task-boards/exclude`, payload)
  return res.data
}

