import { clientHttp } from '@/services/http'
import type {
  PermissionCodeListResponse,
  StaffPermissionListResponse,
  StaffPermissionUpdateRequest,
  StaffPermissionUpdateResponse,
} from '@/types/clientPermission'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/permissions`

export async function getPermissionCodes(activeOnly = true): Promise<PermissionCodeListResponse> {
  const res = await clientHttp.get<PermissionCodeListResponse>(`${BASE}/codes`, {
    params: { active_only: activeOnly },
  })
  return res.data
}

export async function getStaffPermissions(adminId: number): Promise<StaffPermissionListResponse> {
  const res = await clientHttp.get<StaffPermissionListResponse>(`${BASE}/staffs/${adminId}`)
  return res.data
}

export async function updateStaffPermissions(
  adminId: number,
  payload: StaffPermissionUpdateRequest
): Promise<StaffPermissionUpdateResponse> {
  const res = await clientHttp.put<StaffPermissionUpdateResponse>(`${BASE}/staffs/${adminId}`, payload)
  return res.data
}
