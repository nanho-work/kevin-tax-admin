export type DashboardScope = 'client_account' | 'admin'
export type DashboardDeviceType = 'desktop' | 'mobile'

export interface DashboardWidgetCatalogItem {
  widget_id: number
  widget_key: string
  title: string
  description?: string | null
  required_permission_code?: string | null
  default_w: number
  default_h: number
  min_w: number
  min_h: number
  max_w: number
  max_h: number
  supports_mobile: boolean
}

export interface DashboardWidgetCatalogResponse {
  items: DashboardWidgetCatalogItem[]
}

export interface DashboardLayoutPresetItem {
  preset_id: number
  preset_name: string
  device_type: DashboardDeviceType
  is_default: boolean
  layout_version: number
}

export interface DashboardLayoutPresetListResponse {
  items: DashboardLayoutPresetItem[]
}

export interface DashboardUserLayoutItem {
  widget_id: number
  widget_key: string
  title: string
  description?: string | null
  required_permission_code?: string | null
  grid_x: number
  grid_y: number
  grid_w: number
  grid_h: number
  visible: boolean
  sort_order: number
  config_json?: Record<string, unknown> | null
  min_w: number
  min_h: number
  max_w: number
  max_h: number
  supports_mobile: boolean
}

export interface DashboardUserLayoutResponse {
  layout_id: number
  client_id: number
  user_type: DashboardScope
  user_id: number
  device_type: DashboardDeviceType
  layout_version: number
  from_preset_id?: number | null
  is_customized: boolean
  updated_at: string
  items: DashboardUserLayoutItem[]
}

export interface DashboardUserLayoutSaveItem {
  widget_key: string
  grid_x?: number
  grid_y?: number
  grid_w?: number
  grid_h?: number
  visible?: boolean
  sort_order?: number
  config_json?: Record<string, unknown> | null
}

export interface DashboardUserLayoutSaveRequest {
  items: DashboardUserLayoutSaveItem[]
  replace_all: boolean
}

export interface DashboardUserLayoutResetRequest {
  preset_id?: number | null
}

export interface DashboardUserLayoutActionResponse {
  message: string
  layout_id: number
  layout_version: number
  updated_count: number
  created_count: number
  deleted_count: number
}
