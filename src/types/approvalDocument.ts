export type ApprovalDocumentStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'canceled'
export type ApprovalDocumentType = 'leave' | 'equipment' | 'purchase' | 'report' | 'draft' | 'expense' | 'general'

export interface ApprovalDocument {
  id: number
  document_no: string | null
  client_id: number
  writer_admin_id: number
  writer_name?: string | null
  writer_team_id?: number | null
  writer_team_name?: string | null
  writer_department_id?: number | null
  writer_department_name?: string | null
  writer_role_id?: number | null
  writer_role_name?: string | null
  doc_type: ApprovalDocumentType | string
  title: string
  content: string | null
  status: ApprovalDocumentStatus
  submitted_at: string | null
  approved_at: string | null
  rejected_at: string | null
  canceled_at: string | null
  rejected_reason: string | null
  locked_at: string | null
  snapshot_file_key: string | null
  extra_json: Record<string, unknown> | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ApprovalApprover {
  id: number
  step_order: number
  approver_type: string
  approver_client_account_id: number | null
  approver_admin_id: number | null
  status: string
  acted_at: string | null
  comment: string | null
  signature_text: string | null
}

export interface ApprovalAttachment {
  id: number
  version_no: number
  is_active: boolean
  file_name: string
  content_type: string | null
  file_size: number | null
  uploaded_by_admin_id: number | null
  created_at: string
}

export type ApprovalAttachmentAction = 'download' | 'preview'

export type ApprovalDocumentShare = {
  id: number
  share_type: 'cc' | 'viewer'
  target_type: 'admin' | 'team' | 'client_account'
  target_id: number
  is_active: boolean
  created_by_admin_id: number | null
  created_at: string
  updated_at: string
}

export type ApprovalDocumentReadReceipt = {
  id: number
  recipient_type: 'admin' | 'client_account'
  recipient_id: number
  source_type: 'writer' | 'approver' | 'cc' | 'viewer' | 'system'
  read_at: string
  created_at: string
  updated_at: string
  recipient_name?: string | null
}

export interface ApprovalDocumentDetail extends ApprovalDocument {
  approvers: ApprovalApprover[]
  attachments: ApprovalAttachment[]
  shares: ApprovalDocumentShare[]
  read_receipts: ApprovalDocumentReadReceipt[]
}

export interface ApprovalDocumentListResponse {
  total: number
  items: ApprovalDocument[]
  page: number
  limit: number
}

export interface CreateApprovalDocumentPayload {
  doc_type: ApprovalDocumentType
  title: string
  content?: string
  extra_json?: Record<string, unknown>
  approvers?: Array<{
    step_order: number
    approver_type: 'client' | 'admin'
    approver_client_account_id?: number
    approver_admin_id?: number
  }>
  shares?: Array<{
    share_type: 'cc' | 'viewer'
    target_type: 'admin' | 'team' | 'client_account'
    target_id: number
  }>
  submit: boolean
}

export interface ApprovalAttachmentDownloadResponse {
  attachment_id: number
  file_name: string
  download_url: string
  expires_in: number
}

export interface ReviewApprovalDocumentPayload {
  action: 'approved' | 'rejected'
  comment?: string
  signature_text?: string
  rejected_reason?: string
}
