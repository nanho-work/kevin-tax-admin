import { adminHttp, clientHttp } from '@/services/http'

export type ConsultToolScope = 'admin' | 'client'

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

export type ConsultToolIndustryRateItem = {
  industryName: string
  simpleRateGeneral: number
  simpleRateExcess: number
  standardRateGeneral: number
  applyCriteria: string
  middleCategory: string
  subCategory: string
  detailCategory: string
}

export type ConsultToolIndustryRateCurrentResponse = {
  version: ConsultToolIndustryRateVersionOut | null
  rates: Record<string, ConsultToolIndustryRateItem>
}

export type ConsultToolIndustryRateLookupResponse = {
  tax_year: number
  industry_code: string
  found: boolean
  version: ConsultToolIndustryRateVersionOut | null
  rate: ConsultToolIndustryRateItem | null
}

function getScopedHttp(scope: ConsultToolScope) {
  return scope === 'admin' ? adminHttp : clientHttp
}

function basePath(scope: ConsultToolScope) {
  return `${process.env.NEXT_PUBLIC_API_BASE_URL}/${scope}/consult-tool`
}

export async function getConsultToolCurrentIndustryRates(
  scope: ConsultToolScope,
  taxYear: number
): Promise<ConsultToolIndustryRateCurrentResponse> {
  const res = await getScopedHttp(scope).get<ConsultToolIndustryRateCurrentResponse>(
    `${basePath(scope)}/industry-rates/current`,
    { params: { tax_year: taxYear } }
  )
  return res.data
}

export async function lookupConsultToolIndustryRate(
  scope: ConsultToolScope,
  params: { taxYear: number; industryCode: string }
): Promise<ConsultToolIndustryRateLookupResponse> {
  const res = await getScopedHttp(scope).get<ConsultToolIndustryRateLookupResponse>(
    `${basePath(scope)}/industry-rates/lookup`,
    {
      params: {
        tax_year: params.taxYear,
        industry_code: params.industryCode,
      },
    }
  )
  return res.data
}

