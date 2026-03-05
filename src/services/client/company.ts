import { clientHttp } from '@/services/http'
import type {
  CompanyTaxDetail,
  CompanyDetailResponse,
  CompanyUpdateRequest,
  PaginatedResponse,
} from '@/types/admin_campany'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/companies`
const COMPANY_DOC_TYPE_BUSINESS_LICENSE = 'business_license'

export interface ClientCompanyDocumentPreviewResponse {
  file_name: string
  preview_url: string
}

interface FetchCompanyParams {
  page: number
  limit: number
  keyword?: string
  business_type?: 'individual' | 'corporate'
}

export async function fetchClientCompanyTaxList({
  page,
  limit,
  keyword,
  business_type,
}: FetchCompanyParams): Promise<PaginatedResponse<CompanyTaxDetail>> {
  const response = await clientHttp.get<PaginatedResponse<CompanyTaxDetail>>(`${BASE}/tax-info`, {
    params: { page, limit, keyword, business_type },
  })
  return response.data
}

export async function deactivateClientCompany(company_id: number): Promise<{ message: string }> {
  const res = await clientHttp.delete<{ message: string }>(`${BASE}/delete/${company_id}`)
  return res.data
}

export async function fetchClientCompanyDetail(company_id: number): Promise<CompanyDetailResponse> {
  const res = await clientHttp.get<CompanyDetailResponse>(`${BASE}/detail/${company_id}`)
  return res.data
}

export async function updateClientCompany(
  company_id: number,
  payload: CompanyUpdateRequest
): Promise<{ message: string }> {
  const res = await clientHttp.patch<{ message: string }>(`${BASE}/update/${company_id}`, payload)
  return res.data
}

export async function fetchClientCompanyBusinessLicensePreview(
  company_id: number
): Promise<ClientCompanyDocumentPreviewResponse> {
  const res = await clientHttp.get<ClientCompanyDocumentPreviewResponse>(
    `${BASE}/${company_id}/documents/${COMPANY_DOC_TYPE_BUSINESS_LICENSE}/preview`
  )
  return res.data
}

export async function uploadClientCompanyBusinessLicense(
  company_id: number,
  file: File
): Promise<unknown> {
  const form = new FormData()
  form.append('file', file)
  const res = await clientHttp.post(`${BASE}/${company_id}/documents/${COMPANY_DOC_TYPE_BUSINESS_LICENSE}`, form)
  return res.data
}

export async function deleteClientCompanyBusinessLicense(company_id: number): Promise<{ message: string }> {
  const res = await clientHttp.delete<{ message: string }>(
    `${BASE}/${company_id}/documents/${COMPANY_DOC_TYPE_BUSINESS_LICENSE}`
  )
  return res.data
}
