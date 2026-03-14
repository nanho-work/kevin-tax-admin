import { clientHttp } from '@/services/http'
import type { AdminOut } from '@/types/admin'

const CLIENT_STAFF_BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/staffs`

export interface ClientStaffPaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export type ClientAttendanceBoardPeriod = 'week' | 'month'

export interface ClientAttendanceBoardColumn {
  date: string
  weekday: string
  weekday_index: number
}

export interface ClientAttendanceBoardDay {
  date: string
  check_in: string | null
  check_out: string | null
  worked_minutes: number
}

export interface ClientAttendanceBoardItem {
  admin_id: number
  admin_name: string
  team_id: number | null
  role_id: number | null
  days: ClientAttendanceBoardDay[]
}

export interface ClientAttendanceBoardResponse {
  period: ClientAttendanceBoardPeriod
  anchor_date: string
  date_from: string
  date_to: string
  columns: ClientAttendanceBoardColumn[]
  items: ClientAttendanceBoardItem[]
  staff_total: number
}

export interface ClientAttendanceBoardParams {
  period?: ClientAttendanceBoardPeriod
  anchor_date?: string
  team_id?: number
  keyword?: string
  offset?: number
  limit?: number
}

export async function getClientStaffs(
  page: number = 1,
  limit: number = 20,
  keyword?: string
): Promise<ClientStaffPaginatedResponse<AdminOut>> {
  const offset = (page - 1) * limit
  const params: Record<string, any> = { offset, limit }
  if (keyword) params.keyword = keyword

  const res = await clientHttp.get(`${CLIENT_STAFF_BASE}/`, { params })
  return res.data
}

export async function createClientStaff(
  data: FormData
): Promise<{ message: string; id: number; email: string; role: string }> {
  const res = await clientHttp.post(`${CLIENT_STAFF_BASE}/`, data, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return res.data
}

export async function updateClientStaff(
  id: number,
  data: FormData
): Promise<{ message: string }> {
  const res = await clientHttp.put(`${CLIENT_STAFF_BASE}/${id}`, data, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return res.data
}

export async function patchClientStaffTeam(
  adminId: number,
  teamId: number | null
): Promise<{ message: string }> {
  const res = await clientHttp.patch(`${CLIENT_STAFF_BASE}/${adminId}/team`, {
    team_id: teamId,
  })
  return res.data
}

export async function patchClientStaffTeamsBulk(
  items: Array<{ admin_id: number; team_id: number | null }>
): Promise<{ message: string }> {
  const res = await clientHttp.patch(`${CLIENT_STAFF_BASE}/teams/bulk`, { items })
  return res.data
}

export async function deactivateClientStaff(
  id: number
): Promise<{ message: string }> {
  const res = await clientHttp.delete(`${CLIENT_STAFF_BASE}/${id}`)
  return res.data
}

export async function activateClientStaff(
  id: number
): Promise<{ message: string }> {
  const res = await clientHttp.put(`${CLIENT_STAFF_BASE}/${id}/activate`)
  return res.data
}

export async function getClientStaffAttendanceBoard(
  params: ClientAttendanceBoardParams
): Promise<ClientAttendanceBoardResponse> {
  const res = await clientHttp.get(`${CLIENT_STAFF_BASE}/attendance/board`, { params })
  return res.data
}
