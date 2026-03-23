import { clientHttp, getClientAccessToken } from '@/services/http'
import { createMultipartUploadAdapter, uploadViaAdapter } from '@/services/upload/multipartUpload'
import type {
  CompanyTaxDetail,
  CompanyDetailResponse,
  CompanyCreateRequest,
  CompanySimpleResponse,
  CompanyUpdateRequest,
  PaginatedResponse,
} from '@/types/admin_campany'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/companies`
export const COMPANY_DOC_TYPE_BUSINESS_LICENSE = 'business_license'
export const COMPANY_DOC_TYPE_OWNER_ID = 'id_card'
export const COMPANY_DOC_TYPE_BANKBOOK = 'bank_account'

const uploadClientCompanyDocumentAdapter = createMultipartUploadAdapter<
  unknown,
  { file: File; company_id: number; doc_type_code: string }
>({
  url: ({ company_id, doc_type_code }) => `${BASE}/${company_id}/documents/${encodeURIComponent(doc_type_code)}`,
})

const uploadClientCompanyCustomDocumentAdapter = createMultipartUploadAdapter<
  ClientCompanyCustomDocumentOut,
  { file: File; company_id: number; title: string }
>({
  url: ({ company_id }) => `${BASE}/${company_id}/custom-documents`,
  buildFields: ({ title }) => ({ title }),
})

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

export interface ClientCompanyCustomDocumentBulkUploadResponse {
  total: number
  success_count: number
  failed_count: number
  items: Array<{ id: number; title: string; file_name: string }>
  failed_items: Array<{ index: number; file_name: string; title?: string | null; error: string }>
}

export interface ClientHometaxCredentialOut {
  id: number
  client_id: number
  company_id: number
  hometax_login_id: string
  password_set: boolean
  enc_key_version: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ClientHometaxCredentialUpsertRequest {
  hometax_login_id: string
  hometax_password: string
  is_active: boolean
}

export interface ClientHometaxCredentialActivePatchRequest {
  is_active: boolean
}

export interface ClientHometaxCredentialRevealRequest {
  account_password: string
}

export interface ClientHometaxCredentialRevealOut {
  company_id: number
  hometax_login_id: string
  hometax_password: string
  reveal_count: number
}

export interface ClientHometaxCredentialLogOut {
  id: number
  credential_id: number
  client_id: number
  company_id: number
  action: string
  changed_fields?: string[] | null
  actor_type: string
  actor_client_account_id?: number | null
  actor_admin_id?: number | null
  ip?: string | null
  user_agent?: string | null
  created_at: string
}

export interface ClientHometaxCredentialLogListResponse {
  total: number
  items: ClientHometaxCredentialLogOut[]
}

interface FetchCompanyParams {
  page: number
  limit: number
  keyword?: string
  category?: '법인' | '개인'
  business_type?: 'individual' | 'corporate'
}

export async function fetchClientCompanyTaxList({
  page,
  limit,
  keyword,
  category,
  business_type,
}: FetchCompanyParams): Promise<PaginatedResponse<CompanyTaxDetail>> {
  const token = getClientAccessToken()
  const response = await clientHttp.get<PaginatedResponse<CompanyTaxDetail>>(`${BASE}/tax-info`, {
    params: { page, limit, keyword, category, business_type },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  return response.data
}

export async function deactivateClientCompany(company_id: number): Promise<{ message: string }> {
  const res = await clientHttp.delete<{ message: string }>(`${BASE}/delete/${company_id}`)
  return res.data
}

export async function createClientPortalCompany(payload: CompanyCreateRequest): Promise<CompanySimpleResponse> {
  const res = await clientHttp.post<CompanySimpleResponse>(`${BASE}/create`, payload)
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
  return uploadViaAdapter(clientHttp, uploadClientCompanyDocumentAdapter, {
    company_id,
    doc_type_code,
    file,
  })
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
  return uploadViaAdapter(clientHttp, uploadClientCompanyCustomDocumentAdapter, {
    company_id,
    title: params.title,
    file: params.file,
  })
}

export async function uploadClientCompanyCustomDocumentsBulk(
  company_id: number,
  params: { files: File[]; titles?: string[] }
): Promise<ClientCompanyCustomDocumentBulkUploadResponse> {
  const form = new FormData()
  params.files.forEach((file) => form.append('files', file))
  ;(params.titles || []).forEach((title) => form.append('titles', title))
  const res = await clientHttp.post<ClientCompanyCustomDocumentBulkUploadResponse>(
    `${BASE}/${company_id}/custom-documents/bulk`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
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

export async function getClientHometaxCredential(company_id: number): Promise<ClientHometaxCredentialOut> {
  const res = await clientHttp.get<ClientHometaxCredentialOut>(`${BASE}/${company_id}/hometax-credential`)
  return res.data
}

export async function upsertClientHometaxCredential(
  company_id: number,
  payload: ClientHometaxCredentialUpsertRequest
): Promise<ClientHometaxCredentialOut> {
  const res = await clientHttp.put<ClientHometaxCredentialOut>(`${BASE}/${company_id}/hometax-credential`, payload)
  return res.data
}

export async function patchClientHometaxCredentialActive(
  company_id: number,
  payload: ClientHometaxCredentialActivePatchRequest
): Promise<{ message: string }> {
  const res = await clientHttp.patch<{ message: string }>(`${BASE}/${company_id}/hometax-credential/active`, payload)
  return res.data
}

export async function listClientHometaxCredentialLogs(
  company_id: number,
  limit = 50
): Promise<ClientHometaxCredentialLogListResponse> {
  const res = await clientHttp.get<ClientHometaxCredentialLogListResponse>(`${BASE}/${company_id}/hometax-credential/logs`, {
    params: { limit },
  })
  return res.data
}

export async function revealClientHometaxCredentialPassword(
  company_id: number,
  payload: ClientHometaxCredentialRevealRequest
): Promise<ClientHometaxCredentialRevealOut> {
  const res = await clientHttp.post<ClientHometaxCredentialRevealOut>(`${BASE}/${company_id}/hometax-credential/reveal`, payload)
  return res.data
}
