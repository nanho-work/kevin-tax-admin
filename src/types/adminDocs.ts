export type DocsScope = 'personal' | 'shared'
export type DocsViewMode = 'icon' | 'list'
export type DocsSortBy = 'name' | 'updated_at' | 'size'
export type DocsSortOrder = 'asc' | 'desc'

export type DocsFolderItem = {
  id: number
  parent_id: number | null
  scope: DocsScope
  owner_admin_id: number | null
  system_key: string | null
  name: string
  has_children: boolean
  created_at: string
  updated_at: string
}

export type DocsFolderTreeResponse = {
  items: DocsFolderItem[]
}

export type DocsFolderCreatePayload = {
  parent_id?: number | null
  scope?: DocsScope
  name: string
}

export type DocsFolderRenamePayload = {
  name: string
}

export type DocsFolder = {
  id: number
  client_id: number
  scope: DocsScope
  owner_admin_id: number | null
  parent_id: number | null
  system_key: string | null
  name: string
  is_deleted: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type DocsEntryListItem = {
  item_id: string
  item_type: 'folder' | 'file'
  folder_id: number | null
  entry_id: number | null
  name: string
  extension: string | null
  content_type: string | null
  size_bytes: number | null
  has_thumbnail?: boolean
  thumbnail_url?: string | null
  updated_at: string
  created_at: string
}

export type DocsEntryListResponse = {
  folder_id: number
  total: number
  items: DocsEntryListItem[]
}

export type DocsEntry = {
  id: number
  client_id: number
  folder_id: number
  entry_type: 'file'
  name: string
  storage_key: string | null
  content_type: string | null
  extension: string | null
  size_bytes: number | null
  has_thumbnail?: boolean
  thumbnail_key?: string | null
  thumbnail_url?: string | null
  created_by_admin_id: number | null
  updated_by_admin_id: number | null
  is_deleted: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type DocsEntryMovePayload = {
  target_folder_id: number
}

export type DocsEntryRenamePayload = {
  name: string
}

export type DocsMoveBulkPayload = {
  entry_ids: number[]
  target_folder_id: number
}

export type DocsMoveBulkResultItem = {
  entry_id: number
  status: 'moved' | 'skipped' | 'failed'
  reason: string | null
}

export type DocsMoveBulkResponse = {
  moved_count: number
  skipped_count: number
  failed_count: number
  results: DocsMoveBulkResultItem[]
}

export type DocsDownloadBulkPayload = {
  entry_ids: number[]
}

export type DocsDownloadBulkResponse = {
  blob: Blob
  filename: string
}

export type DocsEntryUploadMultipartPayload = {
  folder_id: number
  file: File
}

export type DocsEntryUploadUrlPayload = {
  folder_id: number
  file_name: string
  content_type?: string | null
}

export type DocsEntryUploadUrlResponse = {
  folder_id: number
  file_name: string
  storage_key: string
  upload_url: string
  expires_in: number
  method: 'PUT'
}

export type DocsEntryUploadCompletePayload = {
  folder_id: number
  file_name: string
  storage_key: string
  content_type?: string | null
}

export type DocsEntryDownloadUrlResponse = {
  entry_id: number
  file_name: string
  download_url: string
  expires_in: number
}

export type DocsEntryPreviewUrlResponse = {
  entry_id: number
  file_name: string
  preview_url: string
  expires_in: number
}

export type DocsTrashEntryItem = {
  entry_id: number
  folder_id: number
  folder_name: string
  name: string
  extension: string | null
  content_type: string | null
  size_bytes: number | null
  deleted_at: string
  updated_at: string
}

export type DocsTrashEntryListResponse = {
  total: number
  page: number
  size: number
  items: DocsTrashEntryItem[]
}

export type DocsTrashCountResponse = {
  count: number
}

export type DocsTrashBulkPayload = {
  entry_ids: number[]
}

export type DocsTrashBulkResultItem = {
  entry_id: number
  status: 'restored' | 'deleted' | 'failed'
  reason: string | null
}

export type DocsTrashRestoreBulkResponse = {
  restored_count: number
  failed_count: number
  results: DocsTrashBulkResultItem[]
}

export type DocsTrashDeleteBulkResponse = {
  deleted_count: number
  failed_count: number
  results: DocsTrashBulkResultItem[]
}

export type DocsMessageResponse = {
  message: string
}

export type DocsStorageUsageResponse = {
  plan_code?: string
  plan_name?: string
  quota_bytes: number
  used_active_bytes: number
  used_trash_bytes: number
  used_total_bytes: number
  available_bytes: number
  usage_rate: number
  soft_warn_80: boolean
  hard_warn_95: boolean
}
