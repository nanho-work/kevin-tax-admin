import { adminHttp, getAdminAccessToken } from '@/services/http'
import { createMultipartUploadAdapter, uploadViaAdapter } from '@/services/upload/multipartUpload'
import type {
  CompanyTaxDetail,
  CompanyDetailResponse,
  CompanyUpdateRequest,
  CompanyCreateRequest,
  CompanySimpleResponse,
  PaginatedResponse,
} from '@/types/admin_campany';

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/companies`
export const COMPANY_DOC_TYPE_BUSINESS_LICENSE = 'business_license'
export const COMPANY_DOC_TYPE_OWNER_ID = 'id_card'
export const COMPANY_DOC_TYPE_BANKBOOK = 'bank_account'

export interface CompanyDocumentPreviewResponse {
  file_name: string
  preview_url: string
}

export interface AdminCompanyCustomDocumentOut {
  id: number
  title: string
  file_name: string
  created_at: string
  uploaded_at?: string
}

export interface AdminCompanyCustomDocumentListResponse {
  total: number
  items: AdminCompanyCustomDocumentOut[]
}

export interface AdminCompanyCustomDocumentDownloadUrlOut {
  document_id: number
  file_name: string
  download_url: string
  expires_in: number
}

export interface AdminCompanyCustomDocumentPreviewUrlOut {
  document_id: number
  file_name: string
  preview_url: string
  expires_in: number
}

export interface AdminCompanyCustomDocumentLogListResponse {
  total: number
  items: Array<{ action: string }>
}

const uploadAdminCompanyDocumentAdapter = createMultipartUploadAdapter<
  unknown,
  { file: File; company_id: number; doc_type_code: string }
>({
  url: ({ company_id, doc_type_code }) => `${BASE}/${company_id}/documents/${encodeURIComponent(doc_type_code)}`,
})

const uploadAdminCompanyCustomDocumentAdapter = createMultipartUploadAdapter<
  AdminCompanyCustomDocumentOut,
  { file: File; company_id: number; title: string }
>({
  url: ({ company_id }) => `${BASE}/${company_id}/custom-documents`,
  buildFields: ({ title }) => ({ title }),
})

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
  category,
  business_type,
}: FetchCompanyParams): Promise<PaginatedResponse<CompanyTaxDetail>> {
  const token = getAdminAccessToken()
  const response = await adminHttp.get<PaginatedResponse<CompanyTaxDetail>>(`${BASE}/tax-info`, {
    params: { page, limit, keyword, category, business_type },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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

export async function updateCompany(
  company_id: number,
  payload: CompanyUpdateRequest
): Promise<{ message: string }> {
  const res = await adminHttp.patch<{ message: string }>(`${BASE}/update/${company_id}`, payload)
  return res.data
}

export async function fetchCompanyBusinessLicensePreview(
  company_id: number
): Promise<CompanyDocumentPreviewResponse> {
  return fetchCompanyDocumentPreview(company_id, COMPANY_DOC_TYPE_BUSINESS_LICENSE)
}

export async function fetchCompanyDocumentPreview(
  company_id: number,
  doc_type_code: string
): Promise<CompanyDocumentPreviewResponse> {
  const res = await adminHttp.get<CompanyDocumentPreviewResponse>(
    `${BASE}/${company_id}/documents/${encodeURIComponent(doc_type_code)}/preview`
  )
  return res.data
}

export async function uploadCompanyBusinessLicense(
  company_id: number,
  file: File
): Promise<unknown> {
  return uploadCompanyDocument(company_id, COMPANY_DOC_TYPE_BUSINESS_LICENSE, file)
}

export async function uploadCompanyDocument(
  company_id: number,
  doc_type_code: string,
  file: File
): Promise<unknown> {
  return uploadViaAdapter(adminHttp, uploadAdminCompanyDocumentAdapter, {
    company_id,
    doc_type_code,
    file,
  })
}

export async function deleteCompanyBusinessLicense(company_id: number): Promise<{ message: string }> {
  return deleteCompanyDocument(company_id, COMPANY_DOC_TYPE_BUSINESS_LICENSE)
}

export async function deleteCompanyDocument(
  company_id: number,
  doc_type_code: string
): Promise<{ message: string }> {
  const res = await adminHttp.delete<{ message: string }>(
    `${BASE}/${company_id}/documents/${encodeURIComponent(doc_type_code)}`
  )
  return res.data
}

export async function listAdminCompanyCustomDocuments(
  company_id: number,
  include_deleted = false
): Promise<AdminCompanyCustomDocumentListResponse> {
  const res = await adminHttp.get<AdminCompanyCustomDocumentListResponse>(
    `${BASE}/${company_id}/custom-documents`,
    { params: { include_deleted } }
  )
  return res.data
}

export async function getAdminCompanyCustomDocumentDownloadUrl(
  company_id: number,
  document_id: number
): Promise<AdminCompanyCustomDocumentDownloadUrlOut> {
  const res = await adminHttp.get<AdminCompanyCustomDocumentDownloadUrlOut>(
    `${BASE}/${company_id}/custom-documents/${document_id}/download-url`
  )
  return res.data
}

export async function getAdminCompanyCustomDocumentPreviewUrl(
  company_id: number,
  document_id: number
): Promise<AdminCompanyCustomDocumentPreviewUrlOut> {
  const res = await adminHttp.get<AdminCompanyCustomDocumentPreviewUrlOut>(
    `${BASE}/${company_id}/custom-documents/${document_id}/preview-url`
  )
  return res.data
}

export async function listAdminCompanyCustomDocumentLogs(
  company_id: number,
  document_id: number
): Promise<AdminCompanyCustomDocumentLogListResponse> {
  const res = await adminHttp.get<AdminCompanyCustomDocumentLogListResponse>(
    `${BASE}/${company_id}/custom-documents/${document_id}/logs`
  )
  return res.data
}

export async function uploadAdminCompanyCustomDocument(
  company_id: number,
  params: { title: string; file: File }
): Promise<AdminCompanyCustomDocumentOut> {
  return uploadViaAdapter(adminHttp, uploadAdminCompanyCustomDocumentAdapter, {
    company_id,
    title: params.title,
    file: params.file,
  })
}

export async function deleteAdminCompanyCustomDocument(
  company_id: number,
  document_id: number
): Promise<{ message: string }> {
  const res = await adminHttp.delete<{ message: string }>(
    `${BASE}/${company_id}/custom-documents/${document_id}`
  )
  return res.data
}

export async function restoreAdminCompanyCustomDocument(
  company_id: number,
  document_id: number
): Promise<{ message: string }> {
  const res = await adminHttp.post<{ message: string }>(
    `${BASE}/${company_id}/custom-documents/${document_id}/restore`
  )
  return res.data
}

export async function purgeAdminCompanyCustomDocument(
  company_id: number,
  document_id: number
): Promise<{ message: string }> {
  const res = await adminHttp.delete<{ message: string }>(
    `${BASE}/${company_id}/custom-documents/${document_id}/purge`
  )
  return res.data
}
