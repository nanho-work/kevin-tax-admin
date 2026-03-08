import { clientHttp } from '@/services/http'
import type {
  CompanyAccountCreateRequest,
  CompanyAccountListParams,
  CompanyAccountListResponse,
  CompanyAccountOut,
  CompanyAccountStatus,
} from '@/types/companyAccount'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/company-accounts/`

export async function createClientCompanyAccount(payload: CompanyAccountCreateRequest): Promise<CompanyAccountOut> {
  const res = await clientHttp.post<CompanyAccountOut>(BASE, payload)
  return res.data
}

export async function getClientCompanyAccounts(params: CompanyAccountListParams): Promise<CompanyAccountListResponse> {
  const res = await clientHttp.get<CompanyAccountListResponse>(BASE, { params })
  return res.data
}

export async function updateClientCompanyAccountStatus(
  accountId: number,
  status: CompanyAccountStatus
): Promise<CompanyAccountOut> {
  const res = await clientHttp.patch<CompanyAccountOut>(`${BASE}${accountId}/status`, { status })
  return res.data
}
