export type AdminSheetDocument = {
  id: number
  client_id: number
  source_docs_entry_id: number | null
  owner_admin_id: number | null
  title: string
  sheet_name: string | null
  columns: string[]
  column_widths: Record<string, number>
  created_at: string
  updated_at: string
}

export type AdminSheetRow = {
  id: number
  row_order: number
  row_version: number
  values: Record<string, unknown>
  formulas: Record<string, string>
  updated_at: string
}

export type AdminSheetLock = {
  is_locked: boolean
  lock_token: string | null
  locked_by_admin_id: number | null
  expires_at: string | null
}

export type AdminSheetRowLock = {
  is_locked: boolean
  row_id: number
  lock_token: string | null
  locked_by_admin_id: number | null
  expires_at: string | null
}

export type AdminSheetListResponse = {
  total: number
  page: number
  size: number
  items: AdminSheetDocument[]
}

export type AdminSheetDetailResponse = {
  document: AdminSheetDocument
  lock: AdminSheetLock
  total_rows: number
  rows: AdminSheetRow[]
  styles: AdminSheetCellStyle[]
}

export type AdminSheetRowsPageResponse = {
  total_rows: number
  offset: number
  limit: number
  rows: AdminSheetRow[]
}

export type AdminSheetCellStyle = {
  row_id: number
  col_key: string
  style: Record<string, unknown>
  updated_at: string
}

export type AdminSheetCreateFromDocResponse = {
  created: boolean
  sheet_id: number
  source_docs_entry_id: number
  total_rows: number
  columns: string[]
}

export type AdminSheetRowPatchPayload = {
  row_version: number
  values: Record<string, unknown>
}

export type AdminSheetRowCreatePayload = {
  values: Record<string, unknown>
}

export type AdminSheetColumnRenameRule = {
  from_col: string
  to_col: string
}

export type AdminSheetColumnsPatchPayload = {
  add?: string[]
  remove?: string[]
  rename?: AdminSheetColumnRenameRule[]
  reorder?: string[]
}

export type AdminSheetStylesPatchPayload = {
  row_ids?: number[]
  col_keys?: string[]
  apply_to_all_rows?: boolean
  apply_to_all_cols?: boolean
  style_delta: Record<string, unknown>
}

export type AdminSheetStylesPatchResponse = {
  updated_count: number
}

export type AdminSheetColumnWidthsPatchPayload = {
  widths: Record<string, number>
}

export type AdminSheetLockAcquirePayload = {
  ttl_seconds?: number
}

export type AdminSheetLockHeartbeatPayload = {
  lock_token: string
  ttl_seconds?: number
}

export type AdminSheetRowLockAcquirePayload = {
  ttl_seconds?: number
}

export type AdminSheetRowLockHeartbeatPayload = {
  lock_token: string
  ttl_seconds?: number
}

export type AdminSheetMessageResponse = {
  message: string
}

export type AdminSheetExportResponse = {
  blob: Blob
  filename: string
}
