export interface PermissionCodeOut {
  id: number
  code: string
  group_name: string
  action_name: string
  description?: string | null
  is_active: boolean
}

export interface PermissionCodeListResponse {
  total: number
  items: PermissionCodeOut[]
}

export interface StaffPermissionItemOut {
  permission_code_id: number
  code: string
  group_name: string
  action_name: string
  is_allowed: boolean
}

export interface StaffPermissionListResponse {
  admin_id: number
  admin_name: string
  total: number
  items: StaffPermissionItemOut[]
}

export interface StaffPermissionUpdateItem {
  code: string
  is_allowed: boolean
}

export interface StaffPermissionUpdateRequest {
  items: StaffPermissionUpdateItem[]
}

export interface StaffPermissionUpdateResponse {
  message: string
  admin_id: number
  changed_count: number
  updated_at: string
}
