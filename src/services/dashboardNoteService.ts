import { adminHttp, clientHttp } from '@/services/http'
import type { DashboardNote, DashboardNotePatchRequest } from '@/types/dashboardNote'

type DashboardScope = 'admin' | 'client'

function getHttpByScope(scope: DashboardScope) {
  return scope === 'admin' ? adminHttp : clientHttp
}

function getBase(scope: DashboardScope) {
  return `${process.env.NEXT_PUBLIC_API_BASE_URL}/${scope}/dashboard/note`
}

export async function getDashboardNote(scope: DashboardScope): Promise<DashboardNote> {
  const res = await getHttpByScope(scope).get<DashboardNote>(getBase(scope))
  return res.data
}

export async function patchDashboardNote(scope: DashboardScope, payload: DashboardNotePatchRequest): Promise<DashboardNote> {
  const res = await getHttpByScope(scope).patch<DashboardNote>(getBase(scope), payload)
  return res.data
}
