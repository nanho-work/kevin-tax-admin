import { clientHttp } from '@/services/http'
import type { AdminOut } from '@/types/admin'
import type { CreateStaffRequest, UpdateStaffRequest } from '@/types/admin'

const CLIENT_STAFF_BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/staffs`

export type CreateClientStaffPayload = Omit<CreateStaffRequest, 'team_id' | 'role_id'> & {
  team_id?: number
  role_id?: number
  profile_image?: File | null
}

export type UpdateClientStaffPayload = Omit<UpdateStaffRequest, 'team_id' | 'role_id'> & {
  team_id?: number
  role_id?: number
  profile_image?: File | null
}

type StaffMultipartPayload = {
  login_id?: string
  email?: string
  name?: string
  password?: string
  phone?: string
  hired_at?: string
  birth_date?: string
  retired_at?: string
  client_id?: number | string
  team_id?: number
  role_id?: number
  initial_remaining_days?: number | string
  profile_image?: File | null
}

function toStaffFormData(payload: StaffMultipartPayload): FormData {
  const formData = new FormData()
  if (payload.login_id !== undefined) formData.append('login_id', String(payload.login_id))
  if (payload.email !== undefined) formData.append('email', String(payload.email))
  if (payload.name !== undefined) formData.append('name', String(payload.name))
  if (payload.password !== undefined) formData.append('password', String(payload.password))
  if (payload.phone !== undefined) formData.append('phone', String(payload.phone ?? ''))
  if (payload.hired_at !== undefined) formData.append('hired_at', String(payload.hired_at ?? ''))
  if (payload.birth_date !== undefined) formData.append('birth_date', String(payload.birth_date ?? ''))
  if (payload.retired_at !== undefined) formData.append('retired_at', String(payload.retired_at ?? ''))
  if ('client_id' in payload && payload.client_id !== undefined) formData.append('client_id', String(payload.client_id))
  if (payload.team_id !== undefined) formData.append('team_id', String(payload.team_id ?? ''))
  if (payload.role_id !== undefined) formData.append('role_id', String(payload.role_id ?? ''))
  if ('initial_remaining_days' in payload && payload.initial_remaining_days !== undefined && payload.initial_remaining_days !== '') {
    formData.append('initial_remaining_days', String(payload.initial_remaining_days))
  }
  if (payload.profile_image) {
    formData.append('profile_image', payload.profile_image)
    formData.append('file', payload.profile_image)
  }
  return formData
}

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
  is_holiday?: boolean
  arrival_status?: 'unknown' | 'on_time' | 'late'
  is_late?: boolean
  late_minutes?: number
  raw_late_minutes?: number
  departure_status?: 'unknown' | 'normal' | 'early_leave'
  early_leave_minutes?: number
  required_work_minutes?: number
  short_minutes?: number
  overtime_minutes?: number
  regular_work_minutes?: number
  holiday_work_minutes?: number
  planned_start?: string | null
  planned_end?: string | null
  leave_unit_hint?: 'half_day' | 'quarter_day' | 'hourly' | string | null
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
  policy?: ClientAttendancePolicy
}

export interface ClientAttendancePolicy {
  client_id: number
  timezone: string
  work_start_time: string
  work_end_time: string
  late_grace_minutes: number
  half_day_minutes: number
  quarter_day_minutes: number
  is_half_day_enabled: boolean
  is_quarter_day_enabled: boolean
  created_at?: string
  updated_at?: string
}

export interface ClientAttendancePolicyUpsertPayload {
  timezone: string
  work_start_time: string
  work_end_time: string
  late_grace_minutes: number
  half_day_minutes: number
  quarter_day_minutes: number
  is_half_day_enabled: boolean
  is_quarter_day_enabled: boolean
}

export interface ClientAttendanceBoardParams {
  period?: ClientAttendanceBoardPeriod
  anchor_date?: string
  team_id?: number
  keyword?: string
  offset?: number
  limit?: number
}

export interface ClientAttendanceMonthlySummaryItem {
  admin_id: number
  admin_name: string
  team_id: number | null
  role_id: number | null
  attendance_days: number
  late_days: number
  total_late_minutes: number
  early_leave_days: number
  total_early_leave_minutes: number
  total_worked_minutes: number
  total_required_minutes: number
  total_short_minutes: number
  absent_days?: number
  holiday_work_days?: number
  total_overtime_minutes?: number
  total_regular_work_minutes?: number
  total_holiday_work_minutes?: number
}

export interface ClientAttendanceMonthlySummaryResponse {
  year: number
  month: number
  items: ClientAttendanceMonthlySummaryItem[]
  total: number
  page: number
  limit: number
}

export interface ClientAttendanceMonthlySummaryParams {
  year: number
  month: number
  team_id?: number
  keyword?: string
  offset?: number
  limit?: number
}

export interface ClientAttendanceMonthlySettlementItem {
  admin_id: number
  admin_name: string
  team_id: number | null
  role_id: number | null
  attendance_days?: number
  total_worked_minutes?: number
  total_required_minutes?: number
  total_short_minutes?: number
  total_overtime_minutes?: number
  overtime_multiplier?: number
  weighted_overtime_minutes?: number
  payable_minutes?: number
  [key: string]: unknown
}

export interface ClientAttendanceMonthlySettlementResponse {
  year: number
  month: number
  items: ClientAttendanceMonthlySettlementItem[]
  total: number
  page: number
  limit: number
}

export interface ClientAttendanceMonthlySettlementParams {
  year: number
  month: number
  team_id?: number
  keyword?: string
  offset?: number
  limit?: number
}

export interface ClientAttendanceCalendarDay {
  id: number
  client_id: number
  target_date: string
  day_type: 'holiday' | 'workday'
  name?: string | null
  note?: string | null
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

export interface ClientAttendanceCalendarDayUpsertPayload {
  target_date: string
  day_type: 'holiday' | 'workday'
  name?: string
  note?: string
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
  data: FormData | CreateClientStaffPayload
): Promise<{ message: string; id: number; email: string; role: string }> {
  const requestData = data instanceof FormData ? data : toStaffFormData(data)
  const res = await clientHttp.post(`${CLIENT_STAFF_BASE}/`, requestData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return res.data
}

export async function updateClientStaff(
  id: number,
  data: FormData | UpdateClientStaffPayload
): Promise<{ message: string }> {
  const requestData = data instanceof FormData ? data : toStaffFormData(data)
  const res = await clientHttp.put(`${CLIENT_STAFF_BASE}/${id}`, requestData, {
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

export async function getClientStaffAttendanceMonthlySummary(
  params: ClientAttendanceMonthlySummaryParams
): Promise<ClientAttendanceMonthlySummaryResponse> {
  const res = await clientHttp.get(`${CLIENT_STAFF_BASE}/attendance/monthly-summary`, {
    params: {
      year: params.year,
      month: params.month,
      team_id: params.team_id,
      keyword: params.keyword,
      offset: params.offset ?? 0,
      limit: params.limit ?? 200,
    },
  })
  return res.data
}

export async function getClientStaffAttendanceMonthlySettlement(
  params: ClientAttendanceMonthlySettlementParams
): Promise<ClientAttendanceMonthlySettlementResponse> {
  const res = await clientHttp.get(`${CLIENT_STAFF_BASE}/attendance/monthly-settlement`, {
    params: {
      year: params.year,
      month: params.month,
      team_id: params.team_id,
      keyword: params.keyword,
      offset: params.offset ?? 0,
      limit: params.limit ?? 200,
    },
  })
  return res.data
}

export async function getClientAttendanceCalendar(params?: {
  year?: number
  month?: number
  date_from?: string
  date_to?: string
}): Promise<{ items?: ClientAttendanceCalendarDay[] } | ClientAttendanceCalendarDay[]> {
  const res = await clientHttp.get(`${CLIENT_STAFF_BASE}/attendance/calendar`, {
    params: {
      year: params?.year,
      month: params?.month,
      date_from: params?.date_from,
      date_to: params?.date_to,
    },
  })
  return res.data
}

export async function upsertClientAttendanceCalendarDay(
  payload: ClientAttendanceCalendarDayUpsertPayload
): Promise<ClientAttendanceCalendarDay> {
  const res = await clientHttp.put(`${CLIENT_STAFF_BASE}/attendance/calendar/day`, payload)
  return res.data
}

export async function deleteClientAttendanceCalendarDay(targetDate: string): Promise<{ message?: string }> {
  const res = await clientHttp.delete(`${CLIENT_STAFF_BASE}/attendance/calendar/day`, {
    params: { target_date: targetDate },
  })
  return res.data
}

export async function getClientAttendancePolicy(): Promise<ClientAttendancePolicy> {
  const res = await clientHttp.get(`${CLIENT_STAFF_BASE}/attendance/policy`)
  return res.data
}

export async function updateClientAttendancePolicy(
  payload: ClientAttendancePolicyUpsertPayload
): Promise<ClientAttendancePolicy> {
  const res = await clientHttp.put(`${CLIENT_STAFF_BASE}/attendance/policy`, payload)
  return res.data
}
