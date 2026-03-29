import { getDashboardNote, patchDashboardNote } from '@/services/dashboardNoteService'
import type { DashboardNote, DashboardNotePatchRequest } from '@/types/dashboardNote'

export async function getAdminDashboardNote(): Promise<DashboardNote> {
  return getDashboardNote('admin')
}

export async function patchAdminDashboardNote(payload: DashboardNotePatchRequest): Promise<DashboardNote> {
  return patchDashboardNote('admin', payload)
}
