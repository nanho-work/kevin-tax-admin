// ------------------------------
// 회사 정보 통합 조회 타입 (프론트용)
// ------------------------------

// 페이징 처리 ( 공통 )
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface CompanyTaxDetail {
  id: number
  client_id?: number
  category?: string
  company_name: string
  owner_name: string
  registration_number: string
  business_type?: string
  is_active: boolean
}

// ------------------------------
// 회사 상세 정보 응답 타입
// ------------------------------
export interface CompanyDetailResponse {
  id: number
  client_id?: number
  category?: string
  company_name: string
  owner_name: string
  registration_number?: string
  industry_type?: string
  business_type?: string
  postal_code?: string
  address1?: string
  address2?: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface CompanyUpdateRequest {
  category?: string
  company_name?: string
  owner_name?: string
  registration_number?: string
  industry_type?: string
  business_type?: string
  postal_code?: string
  address1?: string
  address2?: string
  is_active?: boolean
}

// ------------------------------
// 회사 등록 요청 타입
// ------------------------------
export interface CompanyCreateRequest {
  company_name: string
  owner_name: string
  registration_number: string
  category?: string
  industry_type?: string
  business_type?: string
  postal_code?: string
  address1?: string
  address2?: string
  is_active?: boolean
}

// ------------------------------
// 회사 등록 응답 타입 (Simple)
// ------------------------------
export interface CompanySimpleResponse {
  id: number
  company_name: string
  registration_number: string
  created_at: string
}
