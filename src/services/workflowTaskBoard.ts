import type { AxiosError } from 'axios'
import { adminHttp, clientHttp } from '@/services/http'

export type TaskBoardScope = 'admin' | 'client'
export type TaskBoardKind = 'all' | 'corporate' | 'individual'
export type TaskBoardStatus = 'open' | 'closed'
export type TaskTemplateKind = 'base' | 'process'
export type TaskExecutionMode = 'check_only' | 'file_only' | 'file_and_notify'

export interface TaskBoardListItem {
  company_id: number
  company_name: string
  company_kind: 'corporate' | 'individual' | 'unknown' | string
  report_cycle?: 'monthly' | 'semiannual' | null
  payroll_day?: number | null
  payroll_basis?: 'current_month' | 'previous_month' | null
  withholding_due_month?: string | null
  is_withholding_due_in_report_month: boolean
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

export interface TaskBoardEnsureRequest {
  attribution_month: string
  report_month: string
  copy_from_previous?: boolean
}

export interface TaskBoardEnsureResponse {
  created: boolean
  board: TaskBoardOut
}

export type TaskItemStatus = 'not_started' | 'in_progress' | 'done' | 'na'

export interface TaskBoardItem {
  id: number
  board_id: number
  template_id?: number | null
  task_name: string
  task_name_norm: string
  status: TaskItemStatus
  completed_at?: string | null
  note?: string | null
  created_at: string
  updated_at: string
}

export interface TaskBoardItemListResponse {
  total: number
  items: TaskBoardItem[]
}

export interface TaskBoardItemCreateRequest {
  task_name: string
  template_id?: number | null
}

export interface TaskBoardItemUpdateRequest {
  status?: TaskItemStatus
  note?: string | null
}

export interface TaskBoardItemBulkUpsertPayloadItem {
  template_id?: number | null
  task_name: string
  selected: boolean
  status?: TaskItemStatus
  note?: string | null
}

export interface TaskBoardItemBulkUpsertRequest {
  items: TaskBoardItemBulkUpsertPayloadItem[]
}

export interface TaskBoardItemBulkUpsertResponse {
  requested_count: number
  created_count: number
  updated_count: number
  deleted_count: number
  skipped_count: number
}

export interface TaskBoardNoteUpsertRequest {
  attribution_month: string
  report_month: string
  note: string | null
}

export interface TaskBoardNoteOut {
  company_id: number
  attribution_month: string
  report_month: string
  note: string | null
}

export interface TaskTemplateItem {
  id: number
  client_id: number
  company_id: number
  task_name: string
  template_kind?: TaskTemplateKind
  execution_mode?: TaskExecutionMode
  task_name_norm: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TaskTemplateListResponse {
  total: number
  items: TaskTemplateItem[]
}

export interface TaskTemplateCreateRequest {
  task_name: string
  sort_order?: number
  template_kind?: TaskTemplateKind
  execution_mode?: TaskExecutionMode
}

export interface TaskTemplateUpdateRequest {
  task_name?: string
  sort_order?: number
  is_active?: boolean
  template_kind?: TaskTemplateKind
  execution_mode?: TaskExecutionMode
}

export interface TaskTemplateListOptions {
  includeInactive?: boolean
  templateKind?: TaskTemplateKind
}

export interface TaskItemDocLink {
  id: number
  item_id: number
  docs_entry_id: number
  linked_by_type: 'client' | 'admin'
  linked_by_id: number
  created_at: string
}

export interface TaskItemDocLinkListResponse {
  total: number
  items: TaskItemDocLink[]
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

export async function ensureTaskBoard(
  scope: TaskBoardScope,
  companyId: number,
  payload: TaskBoardEnsureRequest
): Promise<TaskBoardEnsureResponse> {
  const http = getHttp(scope)
  const base = getBase(scope)
  const res = await http.post<TaskBoardEnsureResponse>(`${base}/${companyId}/task-boards/ensure`, payload)
  return res.data
}

export async function listTaskBoardItems(
  scope: TaskBoardScope,
  companyId: number,
  boardId: number
): Promise<TaskBoardItemListResponse> {
  const http = getHttp(scope)
  const base = getBase(scope)
  const res = await http.get<TaskBoardItemListResponse>(`${base}/${companyId}/task-boards/${boardId}/items`)
  return res.data
}

export async function createTaskBoardItem(
  scope: TaskBoardScope,
  companyId: number,
  boardId: number,
  payload: TaskBoardItemCreateRequest
): Promise<TaskBoardItem> {
  const http = getHttp(scope)
  const base = getBase(scope)
  const res = await http.post<TaskBoardItem>(`${base}/${companyId}/task-boards/${boardId}/items`, payload)
  return res.data
}

export async function updateTaskBoardItem(
  scope: TaskBoardScope,
  companyId: number,
  boardId: number,
  itemId: number,
  payload: TaskBoardItemUpdateRequest
): Promise<TaskBoardItem> {
  const http = getHttp(scope)
  const base = getBase(scope)
  const res = await http.patch<TaskBoardItem>(`${base}/${companyId}/task-boards/${boardId}/items/${itemId}`, payload)
  return res.data
}

export async function bulkUpsertTaskBoardItems(
  scope: TaskBoardScope,
  companyId: number,
  boardId: number,
  payload: TaskBoardItemBulkUpsertRequest
): Promise<TaskBoardItemBulkUpsertResponse> {
  const http = getHttp(scope)
  const base = getBase(scope)
  const res = await http.post<TaskBoardItemBulkUpsertResponse>(
    `${base}/${companyId}/task-boards/${boardId}/items/bulk-upsert`,
    payload
  )
  return res.data
}

export async function deleteTaskBoardItem(
  scope: TaskBoardScope,
  companyId: number,
  boardId: number,
  itemId: number
): Promise<{ message: string }> {
  const http = getHttp(scope)
  const base = getBase(scope)
  const res = await http.delete<{ message: string }>(`${base}/${companyId}/task-boards/${boardId}/items/${itemId}`)
  return res.data
}

export async function listTaskTemplates(
  scope: TaskBoardScope,
  companyId: number,
  options: boolean | TaskTemplateListOptions = false
): Promise<TaskTemplateListResponse> {
  const http = getHttp(scope)
  const base = getBase(scope)
  const includeInactive = typeof options === 'boolean' ? options : (options.includeInactive ?? false)
  const templateKind = typeof options === 'boolean' ? undefined : options.templateKind
  const res = await http.get<TaskTemplateListResponse>(`${base}/${companyId}/task-templates`, {
    params: {
      include_inactive: includeInactive,
      template_kind: templateKind,
    },
  })
  return res.data
}

export async function createTaskTemplate(
  scope: TaskBoardScope,
  companyId: number,
  payload: TaskTemplateCreateRequest
): Promise<TaskTemplateItem> {
  const http = getHttp(scope)
  const base = getBase(scope)
  const res = await http.post<TaskTemplateItem>(`${base}/${companyId}/task-templates`, payload)
  return res.data
}

export async function updateTaskTemplate(
  scope: TaskBoardScope,
  companyId: number,
  templateId: number,
  payload: TaskTemplateUpdateRequest
): Promise<TaskTemplateItem> {
  const http = getHttp(scope)
  const base = getBase(scope)
  const res = await http.patch<TaskTemplateItem>(`${base}/${companyId}/task-templates/${templateId}`, payload)
  return res.data
}

export async function deleteTaskTemplate(
  scope: TaskBoardScope,
  companyId: number,
  templateId: number
): Promise<TaskTemplateItem> {
  const http = getHttp(scope)
  const base = getBase(scope)
  const res = await http.delete<TaskTemplateItem>(`${base}/${companyId}/task-templates/${templateId}`)
  return res.data
}

export async function listTaskItemDocs(
  scope: TaskBoardScope,
  companyId: number,
  boardId: number,
  itemId: number
): Promise<TaskItemDocLinkListResponse> {
  const http = getHttp(scope)
  const base = getBase(scope)
  const res = await http.get<TaskItemDocLinkListResponse>(`${base}/${companyId}/task-boards/${boardId}/items/${itemId}/docs`)
  return res.data
}

export async function patchTaskBoardNote(
  scope: TaskBoardScope,
  companyId: number,
  payload: TaskBoardNoteUpsertRequest
): Promise<TaskBoardNoteOut> {
  const http = getHttp(scope)
  const base = getBase(scope)
  const res = await http.patch<TaskBoardNoteOut>(`${base}/${companyId}/task-boards/note`, payload)
  return res.data
}
