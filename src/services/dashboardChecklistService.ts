import { adminHttp, clientHttp } from '@/services/http'
import type {
  DashboardChecklistCarryOverRequest,
  DashboardChecklistCarryOverResponse,
  DashboardChecklistDeleteResponse,
  DashboardChecklistItemCreateRequest,
  DashboardChecklistItemOut,
  DashboardChecklistItemPatchRequest,
  DashboardChecklistOut,
} from '@/types/dashboardChecklist'

type DashboardScope = 'admin' | 'client'

function getHttpByScope(scope: DashboardScope) {
  return scope === 'admin' ? adminHttp : clientHttp
}

function getBase(scope: DashboardScope) {
  return `${process.env.NEXT_PUBLIC_API_BASE_URL}/${scope}/dashboard/checklists`
}

export async function getDashboardChecklistByDate(scope: DashboardScope, workDate: string): Promise<DashboardChecklistOut> {
  const res = await getHttpByScope(scope).get<DashboardChecklistOut | { checklist?: DashboardChecklistOut }>(`${getBase(scope)}/by-date`, {
    params: { work_date: workDate },
  })
  if (res.data && typeof res.data === 'object' && 'checklist' in res.data && res.data.checklist) {
    return res.data.checklist
  }
  return res.data as DashboardChecklistOut
}

export async function createDashboardChecklistItem(
  scope: DashboardScope,
  payload: DashboardChecklistItemCreateRequest
): Promise<DashboardChecklistItemOut> {
  const res = await getHttpByScope(scope).post<DashboardChecklistItemOut>(`${getBase(scope)}/items`, payload)
  return res.data
}

export async function patchDashboardChecklistItem(
  scope: DashboardScope,
  itemId: number,
  payload: DashboardChecklistItemPatchRequest
): Promise<DashboardChecklistItemOut> {
  const res = await getHttpByScope(scope).patch<DashboardChecklistItemOut>(`${getBase(scope)}/items/${itemId}`, payload)
  return res.data
}

export async function deleteDashboardChecklistItem(scope: DashboardScope, itemId: number): Promise<DashboardChecklistDeleteResponse> {
  const res = await getHttpByScope(scope).delete<DashboardChecklistDeleteResponse>(`${getBase(scope)}/items/${itemId}`)
  return res.data
}

export async function carryOverDashboardChecklist(
  scope: DashboardScope,
  payload: DashboardChecklistCarryOverRequest
): Promise<DashboardChecklistCarryOverResponse> {
  const res = await getHttpByScope(scope).post<DashboardChecklistCarryOverResponse>(`${getBase(scope)}/carry-over`, payload)
  return res.data
}
