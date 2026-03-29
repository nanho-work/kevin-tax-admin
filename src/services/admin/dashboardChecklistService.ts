import {
  carryOverDashboardChecklist,
  createDashboardChecklistItem,
  deleteDashboardChecklistItem,
  getDashboardChecklistByDate,
  patchDashboardChecklistItem,
} from '@/services/dashboardChecklistService'
import type {
  DashboardChecklistCarryOverRequest,
  DashboardChecklistCarryOverResponse,
  DashboardChecklistDeleteResponse,
  DashboardChecklistItemCreateRequest,
  DashboardChecklistItemOut,
  DashboardChecklistItemPatchRequest,
  DashboardChecklistOut,
} from '@/types/dashboardChecklist'

export async function getAdminDashboardChecklistByDate(workDate: string): Promise<DashboardChecklistOut> {
  return getDashboardChecklistByDate('admin', workDate)
}

export async function createAdminDashboardChecklistItem(
  payload: DashboardChecklistItemCreateRequest
): Promise<DashboardChecklistItemOut> {
  return createDashboardChecklistItem('admin', payload)
}

export async function patchAdminDashboardChecklistItem(
  itemId: number,
  payload: DashboardChecklistItemPatchRequest
): Promise<DashboardChecklistItemOut> {
  return patchDashboardChecklistItem('admin', itemId, payload)
}

export async function deleteAdminDashboardChecklistItem(itemId: number): Promise<DashboardChecklistDeleteResponse> {
  return deleteDashboardChecklistItem('admin', itemId)
}

export async function carryOverAdminDashboardChecklist(
  payload: DashboardChecklistCarryOverRequest
): Promise<DashboardChecklistCarryOverResponse> {
  return carryOverDashboardChecklist('admin', payload)
}
