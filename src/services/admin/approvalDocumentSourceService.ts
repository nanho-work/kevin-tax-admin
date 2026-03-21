import type { AxiosInstance } from 'axios'
import { adminHttp, clientHttp, getAdminAccessToken, getClientAccessToken } from '@/services/http'
import type { AdminOut } from '@/types/admin'
import type { ClientAccountOut } from '@/types/clientAccount'
import type { TeamOut } from '@/types/team'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''

type SourceScope = 'admin' | 'client'

type ApprovalDocumentSourceData = {
  staffs: AdminOut[]
  teams: TeamOut[]
  clientAccounts: ClientAccountOut[]
}

function normalizeList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[]
  if (raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown[] }).items)) {
    return (raw as { items: T[] }).items
  }
  return []
}

async function getWithFallback<T>(
  httpClient: AxiosInstance,
  urls: string[]
): Promise<T[]> {
  let lastError: unknown = null
  for (const url of urls) {
    try {
      const res = await httpClient.get(url, { params: { offset: 0, limit: 200, page: 1 } })
      return normalizeList<T>(res.data)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

function getHttpClient(scope: SourceScope): AxiosInstance {
  return scope === 'admin' ? adminHttp : clientHttp
}

export async function fetchApprovalDocumentSourceData(): Promise<ApprovalDocumentSourceData> {
  if (!API_BASE) {
    return { staffs: [], teams: [], clientAccounts: [] }
  }

  const hasAdminToken = Boolean(getAdminAccessToken())
  const hasClientToken = Boolean(getClientAccessToken())
  if (!hasAdminToken && !hasClientToken) {
    return { staffs: [], teams: [], clientAccounts: [] }
  }

  const staffScope: SourceScope = hasAdminToken ? 'admin' : 'client'
  const teamScope: SourceScope = hasAdminToken ? 'admin' : 'client'

  const staffUrls =
    staffScope === 'admin'
      ? [`${API_BASE}/admin/staffs/`, `${API_BASE}/admin/staffs`]
      : [`${API_BASE}/client/staffs/`, `${API_BASE}/client/staffs`]

  const teamUrls =
    teamScope === 'admin'
      ? [`${API_BASE}/admin/teams/`, `${API_BASE}/admin/teams`]
      : [`${API_BASE}/client/teams/`, `${API_BASE}/client/teams`]

  const loadClientAccounts = async (): Promise<ClientAccountOut[]> => {
    if (hasAdminToken) {
      try {
        return await getWithFallback<ClientAccountOut>(getHttpClient('admin'), [
          `${API_BASE}/admin/client-accounts/`,
          `${API_BASE}/admin/client-accounts`,
        ])
      } catch {
        // no-op: client scope fallback below
      }
    }
    if (hasClientToken) {
      return getWithFallback<ClientAccountOut>(getHttpClient('client'), [
        `${API_BASE}/client/client-accounts/`,
        `${API_BASE}/client/client-accounts`,
      ])
    }
    return []
  }

  const [staffRes, teamRes, accountRes] = await Promise.allSettled([
    getWithFallback<AdminOut>(getHttpClient(staffScope), staffUrls),
    getWithFallback<TeamOut>(getHttpClient(teamScope), teamUrls),
    loadClientAccounts(),
  ])

  return {
    staffs: staffRes.status === 'fulfilled' ? staffRes.value : [],
    teams: teamRes.status === 'fulfilled' ? teamRes.value : [],
    clientAccounts: accountRes.status === 'fulfilled' ? accountRes.value : [],
  }
}

