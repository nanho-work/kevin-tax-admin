import { clientHttp } from '@/services/http'
import type {
  CompanyTaxDetail,
  CompanyDetailResponse,
  CompanyUpdateRequest,
  PaginatedResponse,
} from '@/types/admin_campany'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/companies`
export const COMPANY_DOC_TYPE_BUSINESS_LICENSE = 'business_license'
export const COMPANY_DOC_TYPE_OWNER_ID = 'id_card'
export const COMPANY_DOC_TYPE_BANKBOOK = 'bank_account'

export interface ClientCompanyDocumentPreviewResponse {
  file_name: string
  preview_url: string
}

export interface ClientCompanyCustomDocumentOut {
  id: number
  client_id: number
  company_id: number
  title: string
  file_key: string
  file_name: string
  content_type?: string | null
  file_size: number
  uploaded_by_client_account_id?: number | null
  uploaded_by_admin_id?: number | null
  uploaded_by_type?: string
  uploaded_by_id?: number
  uploaded_at?: string
  is_active: boolean
  deleted_by_type?: string | null
  deleted_by_id?: number | null
  deleted_at?: string | null
  deleted_by_client_account_id?: number | null
  deleted_by_admin_id?: number | null
  created_at: string
  updated_at: string
}

export interface ClientCompanyCustomDocumentListResponse {
  total: number
  items: ClientCompanyCustomDocumentOut[]
}

export interface ClientCompanyCustomDocumentDownloadUrlOut {
  document_id: number
  file_name: string
  download_url: string
  expires_in: number
}

export interface ClientCompanyCustomDocumentPreviewUrlOut {
  document_id: number
  file_name: string
  preview_url: string
  expires_in: number
}

export interface ClientCompanyCustomDocumentLogOut {
  id: number
  client_id: number
  company_id: number
  document_id: number
  action: string
  actor_type: string
  actor_client_account_id?: number | null
  actor_admin_id?: number | null
  created_at: string
}

export interface ClientCompanyCustomDocumentLogListResponse {
  total: number
  items: ClientCompanyCustomDocumentLogOut[]
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
  return fetchClientCompanyDocumentPreview(company_id, COMPANY_DOC_TYPE_BUSINESS_LICENSE)
}

export async function fetchClientCompanyDocumentPreview(
  company_id: number,
  doc_type_code: string
): Promise<ClientCompanyDocumentPreviewResponse> {
  const res = await clientHttp.get<ClientCompanyDocumentPreviewResponse>(
    `${BASE}/${company_id}/documents/${encodeURIComponent(doc_type_code)}/preview`
  )
  return res.data
}

export async function uploadClientCompanyBusinessLicense(
  company_id: number,
  file: File
): Promise<unknown> {
  return uploadClientCompanyDocument(company_id, COMPANY_DOC_TYPE_BUSINESS_LICENSE, file)
}

export async function uploadClientCompanyDocument(
  company_id: number,
  doc_type_code: string,
  file: File
): Promise<unknown> {
  const form = new FormData()
  form.append('file', file)
  const res = await clientHttp.post(`${BASE}/${company_id}/documents/${encodeURIComponent(doc_type_code)}`, form)
  return res.data
}

export async function deleteClientCompanyBusinessLicense(company_id: number): Promise<{ message: string }> {
  return deleteClientCompanyDocument(company_id, COMPANY_DOC_TYPE_BUSINESS_LICENSE)
}

export async function deleteClientCompanyDocument(
  company_id: number,
  doc_type_code: string
): Promise<{ message: string }> {
  const res = await clientHttp.delete<{ message: string }>(
    `${BASE}/${company_id}/documents/${encodeURIComponent(doc_type_code)}`
  )
  return res.data
}

export async function uploadClientCompanyCustomDocument(
  company_id: number,
  params: { title: string; file: File }
): Promise<ClientCompanyCustomDocumentOut> {
  const form = new FormData()
  form.append('title', params.title)
  form.append('file', params.file)
  const res = await clientHttp.post<ClientCompanyCustomDocumentOut>(`${BASE}/${company_id}/custom-documents`, form)
  return res.data
}

export async function listClientCompanyCustomDocuments(
  company_id: number,
  include_deleted = false
): Promise<ClientCompanyCustomDocumentListResponse> {
  const res = await clientHttp.get<ClientCompanyCustomDocumentListResponse>(`${BASE}/${company_id}/custom-documents`, {
    params: { include_deleted },
  })
  return res.data
}

export async function getClientCompanyCustomDocumentDownloadUrl(
  company_id: number,
  document_id: number
): Promise<ClientCompanyCustomDocumentDownloadUrlOut> {
  const res = await clientHttp.get<ClientCompanyCustomDocumentDownloadUrlOut>(
    `${BASE}/${company_id}/custom-documents/${document_id}/download-url`
  )
  return res.data
}

export async function listClientCompanyCustomDocumentLogs(
  company_id: number,
  document_id: number
): Promise<ClientCompanyCustomDocumentLogListResponse> {
  const res = await clientHttp.get<ClientCompanyCustomDocumentLogListResponse>(
    `${BASE}/${company_id}/custom-documents/${document_id}/logs`
  )
  return res.data
}

export async function getClientCompanyCustomDocumentPreviewUrl(
  company_id: number,
  document_id: number
): Promise<ClientCompanyCustomDocumentPreviewUrlOut> {
  const res = await clientHttp.get<ClientCompanyCustomDocumentPreviewUrlOut>(
    `${BASE}/${company_id}/custom-documents/${document_id}/preview-url`
  )
  return res.data
}

export async function deleteClientCompanyCustomDocument(
  company_id: number,
  document_id: number
): Promise<{ message: string }> {
  const res = await clientHttp.delete<{ message: string }>(`${BASE}/${company_id}/custom-documents/${document_id}`)
  return res.data
}
