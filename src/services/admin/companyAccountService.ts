import { adminHttp } from '@/services/http'
import type {
  CompanyAccountCreateRequest,
  CompanyAccountListParams,
  CompanyAccountListResponse,
  CompanyAccountOut,
  CompanyAccountStatus,
} from '@/types/companyAccount'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/company/accounts`

export async function createCompanyAccount(payload: CompanyAccountCreateRequest): Promise<CompanyAccountOut> {
  const res = await adminHttp.post<CompanyAccountOut>(BASE, payload)
  return res.data
}

export async function getCompanyAccounts(params: CompanyAccountListParams): Promise<CompanyAccountListResponse> {
  const res = await adminHttp.get<CompanyAccountListResponse>(BASE, { params })
  return res.data
}

export async function updateCompanyAccountStatus(
  accountId: number,
  status: CompanyAccountStatus
): Promise<CompanyAccountOut> {
  const res = await adminHttp.patch<CompanyAccountOut>(`${BASE}/${accountId}/status`, { status })
  return res.data
}

