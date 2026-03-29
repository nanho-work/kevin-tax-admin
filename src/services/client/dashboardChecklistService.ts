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

export async function getClientDashboardChecklistByDate(workDate: string): Promise<DashboardChecklistOut> {
  return getDashboardChecklistByDate('client', workDate)
}

export async function createClientDashboardChecklistItem(
  payload: DashboardChecklistItemCreateRequest
): Promise<DashboardChecklistItemOut> {
  return createDashboardChecklistItem('client', payload)
}

export async function patchClientDashboardChecklistItem(
  itemId: number,
  payload: DashboardChecklistItemPatchRequest
): Promise<DashboardChecklistItemOut> {
  return patchDashboardChecklistItem('client', itemId, payload)
}

export async function deleteClientDashboardChecklistItem(itemId: number): Promise<DashboardChecklistDeleteResponse> {
  return deleteDashboardChecklistItem('client', itemId)
}

export async function carryOverClientDashboardChecklist(
  payload: DashboardChecklistCarryOverRequest
): Promise<DashboardChecklistCarryOverResponse> {
  return carryOverDashboardChecklist('client', payload)
}
