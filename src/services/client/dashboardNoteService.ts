import { getDashboardNote, patchDashboardNote } from '@/services/dashboardNoteService'
import type { DashboardNote, DashboardNotePatchRequest } from '@/types/dashboardNote'

export async function getClientDashboardNote(): Promise<DashboardNote> {
  return getDashboardNote('client')
}

export async function patchClientDashboardNote(payload: DashboardNotePatchRequest): Promise<DashboardNote> {
  return patchDashboardNote('client', payload)
}
