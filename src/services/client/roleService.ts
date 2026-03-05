import { clientHttp } from '@/services/http'
import type { RoleCreate, RoleOut } from '@/types/role'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/roles`

export async function getRoles(): Promise<RoleOut[]> {
  const response = await clientHttp.get(`${BASE}/`)
  return response.data
}

export async function createRole(data: RoleCreate): Promise<RoleOut> {
  const response = await clientHttp.post(`${BASE}/`, data)
  return response.data
}

export async function deleteRole(roleId: number): Promise<{ detail: string }> {
  const response = await clientHttp.delete(`${BASE}/${roleId}`)
  return response.data
}
