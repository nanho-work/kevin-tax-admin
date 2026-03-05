import { adminHttp } from '@/services/http'
import type {
  CompanyTaxDetail,
  CompanyDetailResponse,
  CompanyUpdateRequest,
  CompanyCreateRequest,
  CompanySimpleResponse,
  PaginatedResponse,
} from '@/types/admin_campany';

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/companies`
const COMPANY_DOC_TYPE_BUSINESS_LICENSE = 'business_license'

export interface CompanyDocumentPreviewResponse {
  file_name: string
  preview_url: string
}

interface FetchCompanyParams {
  page: number;
  limit: number;
  keyword?: string;
  category?: string;
  business_type?: 'individual' | 'corporate';
}

// ------------------------------
// 회사 정보 통합 조회 (프론트용)
// ------------------------------
export async function fetchCompanyTaxList({
  page,
  limit,
  keyword,
  business_type,

}: FetchCompanyParams): Promise<PaginatedResponse<CompanyTaxDetail>> {
  const response = await adminHttp.get<PaginatedResponse<CompanyTaxDetail>>(`${BASE}/tax-info`, {
    params: { page, limit, keyword, business_type },
  });
  return response.data;
}

// ------------------------------
// 회사 상세 정보 
// ------------------------------
export async function fetchCompanyDetail(company_id: number): Promise<CompanyDetailResponse> {
  const res = await adminHttp.get<CompanyDetailResponse>(`${BASE}/detail/${company_id}`)
  return res.data
}


/**
 * 회사 등록 요청
 * @param payload CompanyCreateRequest 형식의 등록 요청 데이터
 * @returns 등록된 회사의 간단한 정보 (CompanySimpleResponse)
 */
export async function createCompany(
  payload: CompanyCreateRequest
): Promise<CompanySimpleResponse> {
  const res = await adminHttp.post<CompanySimpleResponse>(`${BASE}/create`, payload);
  return res.data;
}

export async function fetchCompanyBusinessLicensePreview(
  company_id: number
): Promise<CompanyDocumentPreviewResponse> {
  const res = await adminHttp.get<CompanyDocumentPreviewResponse>(
    `${BASE}/${company_id}/documents/${COMPANY_DOC_TYPE_BUSINESS_LICENSE}/preview`
  )
  return res.data
}
