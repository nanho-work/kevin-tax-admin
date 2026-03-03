import { clientHttp } from '@/services/http'
import type { ClientCreateRequest, ClientOut } from '@/types/Client'
import type {
  ClientAccountCreateRequest,
  ClientAccountListFilters,
  ClientAccountOut,
} from '@/types/clientAccount'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''
const CLIENT_BASE = `${API_BASE}/client/clients`
const CLIENT_ACCOUNT_BASE = `${API_BASE}/client/client-accounts`

function normalizeClientAccountList(data: unknown): ClientAccountOut[] {
  const parsed = data as { items?: ClientAccountOut[] } | ClientAccountOut[] | null
  if (!parsed) return []
  if (Array.isArray(parsed)) return parsed
  return Array.isArray(parsed.items) ? parsed.items : []
}

export async function createClientCompany(payload: ClientCreateRequest): Promise<ClientOut> {
  const res = await clientHttp.post<ClientOut>(`${CLIENT_BASE}/`, payload)
  return res.data
}

export async function createClientAccount(payload: ClientAccountCreateRequest): Promise<ClientAccountOut> {
  const res = await clientHttp.post<ClientAccountOut>(`${CLIENT_ACCOUNT_BASE}/`, payload)
  return res.data
}

export async function listClientAccounts(filters: ClientAccountListFilters): Promise<ClientAccountOut[]> {
  const res = await clientHttp.get(`${CLIENT_ACCOUNT_BASE}/`, { params: filters })
  return normalizeClientAccountList(res.data)
}

export async function deactivateClientAccount(accountId: number): Promise<{ message?: string } | ClientAccountOut> {
  const res = await clientHttp.delete(`${CLIENT_ACCOUNT_BASE}/${accountId}`)
  return res.data
}
