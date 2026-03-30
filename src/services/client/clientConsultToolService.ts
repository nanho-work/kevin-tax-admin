import { clientHttp } from '@/services/http'
import { createMultipartUploadAdapter, uploadViaAdapter } from '@/services/upload/multipartUpload'
import type { ConsultToolIndustryRateCurrentResponse } from '@/services/consultToolService'

export type ConsultToolIndustryRateVersionOut = {
  version_id: number
  client_id: number
  tax_year: number
  version_label: string
  source_file_name: string
  row_count: number
  is_active: boolean
  uploaded_by_admin_id?: number | null
  created_at: string
  updated_at: string
}

export type ConsultToolIndustryRateUploadResponse = {
  message: string
  version: ConsultToolIndustryRateVersionOut
}

export type ConsultToolIndustryRateVersionListResponse = {
  items: ConsultToolIndustryRateVersionOut[]
  total_count: number
}

export type ConsultToolIndustryRatePreviewResponse = {
  version: ConsultToolIndustryRateVersionOut | null
  limit: number
  rows: Array<{
    industry_code: string
    rate: Record<string, unknown>
  }>
}

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/consult-tool`

const uploadClientIndustryRatesAdapter = createMultipartUploadAdapter<
  ConsultToolIndustryRateUploadResponse,
  { file: File; taxYear: number }
>({
  url: ({ taxYear }) => `${BASE}/industry-rates/upload?tax_year=${encodeURIComponent(String(taxYear))}`,
})

export async function uploadClientIndustryRates(
  taxYear: number,
  file: File
): Promise<ConsultToolIndustryRateUploadResponse> {
  return uploadViaAdapter(clientHttp, uploadClientIndustryRatesAdapter, { taxYear, file })
}

export async function getClientIndustryRatesCurrent(
  taxYear: number
): Promise<ConsultToolIndustryRateCurrentResponse> {
  const res = await clientHttp.get<ConsultToolIndustryRateCurrentResponse>(`${BASE}/industry-rates/current`, {
    params: { tax_year: taxYear },
  })
  return res.data
}

export async function listClientIndustryRateVersions(
  activeOnly = true
): Promise<ConsultToolIndustryRateVersionListResponse> {
  const res = await clientHttp.get<ConsultToolIndustryRateVersionListResponse>(`${BASE}/industry-rates/versions`, {
    params: { active_only: activeOnly },
  })
  return res.data
}

export async function previewClientIndustryRates(params: {
  taxYear: number
  limit?: number
}): Promise<ConsultToolIndustryRatePreviewResponse> {
  const res = await clientHttp.get<ConsultToolIndustryRatePreviewResponse>(`${BASE}/industry-rates/preview`, {
    params: {
      tax_year: params.taxYear,
      limit: params.limit ?? 5,
    },
  })
  return res.data
}
