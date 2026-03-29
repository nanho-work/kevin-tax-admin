export type DashboardChecklistUserType = 'client_account' | 'admin'

export interface DashboardChecklistItemOut {
  item_id: number
  checklist_id: number
  content: string
  is_done: boolean
  sort_order: number
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface DashboardChecklistOut {
  checklist_id: number
  client_id: number
  user_type: DashboardChecklistUserType
  user_id: number
  work_date: string
  title: string
  created_at: string
  updated_at: string
  items: DashboardChecklistItemOut[]
  total_count: number
  done_count: number
}

export interface DashboardChecklistItemCreateRequest {
  work_date?: string
  content: string
  sort_order?: number
}

export interface DashboardChecklistItemPatchRequest {
  content?: string
  is_done?: boolean
  sort_order?: number
}

export interface DashboardChecklistDeleteResponse {
  message: string
  deleted_item_id: number
}

export interface DashboardChecklistCarryOverRequest {
  from_date: string
  to_date?: string
  include_done?: boolean
}

export interface DashboardChecklistCarryOverResponse {
  message: string
  from_date: string
  to_date: string
  moved_count: number
}

export interface DashboardChecklistCalendarSummaryItem {
  work_date: string
  total_count: number
  done_count: number
}
