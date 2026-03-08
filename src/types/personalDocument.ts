export type PersonalDocumentDocType = 'id_card' | 'bank_account'

export type PersonalDocumentAction = 'preview' | 'download' | 'delete'

export interface PersonalDocument {
  id: number
  client_id: number
  admin_id: number
  doc_type_code: PersonalDocumentDocType | string
  file_name: string
  content_type?: string | null
  file_size?: number | null
  is_active: boolean
  uploaded_by_type: 'admin' | 'client' | string
  uploaded_by_admin_id?: number | null
  uploaded_by_client_account_id?: number | null
  uploaded_at: string
  deleted_at?: string | null
  deleted_by_type?: 'admin' | 'client' | null
  created_at: string
  updated_at: string
}

export interface PersonalDocumentListResponse {
  total: number
  items: PersonalDocument[]
}

export interface PersonalDocumentStatusItem {
  doc_type_code: PersonalDocumentDocType | string
  is_registered: boolean
  latest_document_id?: number | null
  latest_uploaded_at?: string | null
}

export interface PersonalDocumentStatusResponse {
  admin_id: number
  statuses: PersonalDocumentStatusItem[]
}

export interface PersonalDocumentUrlResponse {
  document_id: number
  file_name: string
  url: string
  expires_in: number
}
