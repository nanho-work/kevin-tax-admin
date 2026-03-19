import type { CreateStaffRequest, UpdateStaffRequest, AdminOut } from '@/types/admin'
import { adminHttp } from '@/services/http'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin`

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export type CreateAdminStaffPayload = Omit<CreateStaffRequest, 'team_id' | 'role_id'> & {
  team_id?: number
  role_id?: number
  profile_image?: File | null
}

export type UpdateAdminStaffPayload = Omit<UpdateStaffRequest, 'team_id' | 'role_id' | 'profile_image_url'> & {
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
  if (payload.client_id !== undefined) formData.append('client_id', String(payload.client_id))
  if (payload.team_id !== undefined) formData.append('team_id', String(payload.team_id ?? ''))
  if (payload.role_id !== undefined) formData.append('role_id', String(payload.role_id ?? ''))
  if (payload.initial_remaining_days !== undefined && payload.initial_remaining_days !== '') {
    formData.append('initial_remaining_days', String(payload.initial_remaining_days))
  }
  if (payload.profile_image) {
    formData.append('profile_image', payload.profile_image)
    formData.append('file', payload.profile_image)
  }
  return formData
}

export async function getAdminStaffs(
  page = 1,
  limit = 20,
  keyword?: string
): Promise<PaginatedResponse<AdminOut>> {
  const offset = (page - 1) * limit
  const params: Record<string, string | number> = { offset, limit }
  if (keyword) params.keyword = keyword
  const res = await adminHttp.get<PaginatedResponse<AdminOut>>(`${BASE}/staffs`, { params })
  return res.data
}

export async function createAdminStaff(
  data: FormData | CreateAdminStaffPayload
): Promise<{ message: string; id: number; email: string; role: string }> {
  const requestData = data instanceof FormData ? data : toStaffFormData(data)
  const res = await adminHttp.post<{ message: string; id: number; email: string; role: string }>(
    `${BASE}/staffs`,
    requestData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  )
  return res.data
}

export async function updateAdminStaff(
  id: number,
  data: FormData | UpdateAdminStaffPayload
): Promise<{ message: string }> {
  const requestData = data instanceof FormData ? data : toStaffFormData(data)
  const res = await adminHttp.put<{ message: string }>(`${BASE}/staffs/${id}`, requestData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function deactivateAdminStaff(id: number): Promise<{ message: string }> {
  const res = await adminHttp.delete<{ message: string }>(`${BASE}/staffs/${id}`)
  return res.data
}

export async function activateAdminStaff(id: number): Promise<{ message: string }> {
  const res = await adminHttp.put<{ message: string }>(`${BASE}/staffs/${id}/activate`)
  return res.data
}
