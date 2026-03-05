export type CompanyAccountStatus = 'active' | 'inactive'

export interface CompanyAccountCreateRequest {
  company_id: number
  login_id: string
  password: string
}

export interface CompanyAccountOut {
  id: number
  company_id: number
  company_name?: string | null
  login_id: string
  status: CompanyAccountStatus
  last_login_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface CompanyAccountListParams {
  status?: CompanyAccountStatus
  company_id?: number
  q?: string
  page?: number
  limit?: number
}

export interface CompanyAccountListResponse {
  items: CompanyAccountOut[]
  total: number
  page: number
  limit: number
}

export interface CompanyAccountStatusUpdateRequest {
  status: CompanyAccountStatus
}

