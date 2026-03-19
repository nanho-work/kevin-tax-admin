export type WorkPostType = 'notice' | 'task'
export type WorkPostStatus = 'draft' | 'published' | 'archived'
export type WorkPostPriority = 'low' | 'normal' | 'high' | 'critical'

export type WorkPostTargetType =
  | 'all_admin'
  | 'team'
  | 'admin'
  | 'all_company'
  | 'company'
  | 'client_account'

export type WorkPostRecipientType = 'client_account' | 'admin' | 'company_account' | 'partner_account'
export type WorkPostReceiptStatus = 'unread' | 'read' | 'ack' | 'in_progress' | 'done'

export interface WorkPostTargetIn {
  target_type: WorkPostTargetType
  target_id?: number | null
}

export interface WorkPostTargetOut {
  id: number
  target_type: WorkPostTargetType
  target_id?: number | null
  created_at: string
}

export interface WorkPostCreatePayload {
  post_type: WorkPostType
  title: string
  body_html: string
  status: WorkPostStatus
  priority: WorkPostPriority
  published_at?: string | null
  due_at?: string | null
  targets: WorkPostTargetIn[]
}

export interface WorkPostUpdatePayload {
  title?: string
  body_html?: string
  status?: WorkPostStatus
  priority?: WorkPostPriority
  published_at?: string | null
  due_at?: string | null
  targets?: WorkPostTargetIn[]
}

export interface WorkPostItem {
  id: number
  post_type: WorkPostType
  title: string
  body_html: string
  view_count?: number
  status: WorkPostStatus
  priority: WorkPostPriority
  published_at?: string | null
  due_at?: string | null
  created_by_type: 'client_account' | 'admin' | 'system'
  created_by_id?: number | null
  updated_by_type?: 'client_account' | 'admin' | 'system' | null
  updated_by_id?: number | null
  is_active: boolean
  created_at: string
  updated_at: string
  targets: WorkPostTargetOut[]
  attachment_count: number
}

export interface WorkPostAttachment {
  id: number
  file_name: string
  content_type?: string | null
  file_size?: number | null
  version_no: number
  created_at: string
  preview_url?: string | null
  download_url?: string | null
}

export interface WorkPostAttachmentListResponse {
  total: number
  items: WorkPostAttachment[]
}

export interface WorkPostDetail extends WorkPostItem {
  attachments: WorkPostAttachment[]
}

export interface WorkPostListResponse {
  total: number
  items: WorkPostItem[]
}

export interface WorkPostActionResponse {
  message: string
}

export interface WorkPostReceipt {
  id: number
  recipient_type: WorkPostRecipientType
  recipient_id: number
  status: WorkPostReceiptStatus
  read_at?: string | null
  ack_at?: string | null
  in_progress_at?: string | null
  done_at?: string | null
  is_hidden: boolean
  hidden_at?: string | null
  updated_at: string
}

export interface WorkPostReceiptListResponse {
  total: number
  items: WorkPostReceipt[]
}

export interface WorkPostInboxItem {
  receipt_id: number
  post_id: number
  post_type: WorkPostType
  title: string
  view_count?: number
  attachment_count?: number
  writer_name?: string | null
  created_by_name?: string | null
  created_by_type?: 'client_account' | 'admin' | 'system' | null
  created_by_id?: number | null
  priority: WorkPostPriority
  status: WorkPostReceiptStatus
  read_at?: string | null
  ack_at?: string | null
  in_progress_at?: string | null
  done_at?: string | null
  is_hidden: boolean
  published_at?: string | null
  due_at?: string | null
  created_at: string
  updated_at: string
}

export interface WorkPostInboxListResponse {
  total: number
  items: WorkPostInboxItem[]
}
