export interface AdminSensitiveProfile {
  admin_id: number
  client_id: number
  resident_number_masked?: string | null
  bank_name?: string | null
  account_holder?: string | null
  account_number_masked?: string | null
  zip_code?: string | null
  address1?: string | null
  address2?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  has_resident_number: boolean
  has_account_number: boolean
  enc_key_version: string
  created_at: string
  updated_at: string
}

export interface AdminSensitiveProfileUpsertPayload {
  resident_number?: string
  bank_name?: string
  account_holder?: string
  account_number?: string
  zip_code?: string
  address1?: string
  address2?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  reason?: string
  payroll_processing_agreed?: boolean
  payroll_processing_term_id?: number
  rrn_processing_agreed?: boolean
  rrn_processing_term_id?: number
}

export interface AdminSensitiveRevealPayload {
  account_password: string
  reason?: string
  include_resident_number?: boolean
  include_account_number?: boolean
}

export interface AdminSensitiveRevealResponse {
  admin_id: number
  resident_number?: string | null
  account_number?: string | null
}

export interface AdminSensitiveAccessLog {
  id: number
  client_id: number
  admin_id: number
  action: 'view' | 'update' | 'download' | 'reveal' | string
  reason?: string | null
  actor_type: 'client' | 'admin' | 'system' | string
  actor_client_account_id?: number | null
  actor_admin_id?: number | null
  ip?: string | null
  user_agent?: string | null
  created_at: string
}

export interface AdminSensitiveAccessLogListResponse {
  total: number
  items: AdminSensitiveAccessLog[]
}

export interface AdminSensitiveConsentTerm {
  id: number
  code: string
  version: number
  title: string
  content: string
  is_required?: boolean
  is_active?: boolean
  effective_from?: string | null
  created_at?: string
}

export interface AdminSensitiveConsentRecord {
  id?: number
  code: string
  term_id?: number | null
  term_version?: number | null
  version?: number | null
  is_agreed?: boolean
  agreed_at?: string | null
  created_at?: string | null
}
