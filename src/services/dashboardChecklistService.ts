import { adminHttp, clientHttp } from '@/services/http'
import type {
  DashboardChecklistCalendarSummaryItem,
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

function normalizeDateKey(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const text = raw.trim()
  if (!text) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  if (text.includes('T') && /^\d{4}-\d{2}-\d{2}T/.test(text)) return text.slice(0, 10)

  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (match) {
    const [, y, m, d] = match
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return ''
}

function toSafeNumber(raw: unknown): number {
  const value = Number(raw)
  return Number.isFinite(value) ? value : 0
}

function normalizeChecklistCalendarItems(payload: unknown): DashboardChecklistCalendarSummaryItem[] {
  const toItem = (row: unknown): DashboardChecklistCalendarSummaryItem | null => {
    if (!row || typeof row !== 'object') return null
    const value = row as Record<string, unknown>
    const workDate = normalizeDateKey(value.work_date ?? value.date ?? value.day ?? value.target_date)
    if (!workDate) return null
    const totalCount = toSafeNumber(value.total_count ?? value.total ?? value.item_count ?? value.count)
    const doneCount = toSafeNumber(value.done_count ?? value.done ?? value.completed_count)
    return {
      work_date: workDate,
      total_count: totalCount,
      done_count: doneCount,
    }
  }

  if (Array.isArray(payload)) {
    return payload.map(toItem).filter((item): item is DashboardChecklistCalendarSummaryItem => item !== null)
  }

  if (payload && typeof payload === 'object') {
    const value = payload as Record<string, unknown>
    const candidates = [value.items, value.results, value.days, value.data]
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.map(toItem).filter((item): item is DashboardChecklistCalendarSummaryItem => item !== null)
      }
    }
  }

  return []
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

export async function getDashboardChecklistCalendarSummary(
  scope: DashboardScope,
  year: number,
  month: number
): Promise<DashboardChecklistCalendarSummaryItem[]> {
  const res = await getHttpByScope(scope).get<unknown>(`${getBase(scope)}/calendar`, {
    params: { year, month },
  })
  return normalizeChecklistCalendarItems(res.data)
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
