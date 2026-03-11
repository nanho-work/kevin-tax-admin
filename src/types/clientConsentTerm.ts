export interface ClientConsentTerm {
  id: number
  code: string
  version: number
  title: string
  content: string
  is_required: boolean
  is_active: boolean
  effective_from: string
  created_at: string
}

export interface ClientConsentTermListResponse {
  total: number
  items: ClientConsentTerm[]
}

export interface ClientConsentTermListParams {
  code?: string
  is_active?: boolean
  is_required?: boolean
}

export interface ClientConsentTermCreatePayload {
  code: string
  version?: number
  title: string
  content: string
  is_required?: boolean
  is_active?: boolean
  effective_from: string
}

export interface ClientConsentTermUpdatePayload {
  title?: string
  content?: string
  is_required?: boolean
  is_active?: boolean
  effective_from?: string
}
