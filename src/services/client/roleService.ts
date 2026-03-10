import { clientHttp } from '@/services/http'
import type { RoleCreate, RoleOut } from '@/types/role'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/roles`

export async function getRoles(): Promise<RoleOut[]> {
  const response = await clientHttp.get(`${BASE}/`)
  const rows = Array.isArray(response.data) ? response.data : []
  return rows.map((row) => {
    const rank = typeof row?.rank_order === 'number' ? row.rank_order : undefined
    return {
      ...row,
      rank_order: rank,
    } as RoleOut
  })
}

export async function createRole(data: RoleCreate): Promise<RoleOut> {
  const payload: RoleCreate = {
    name: data.name,
    description: data.description,
  }
  if (typeof data.rank_order === 'number') {
    payload.rank_order = data.rank_order
  }
  const response = await clientHttp.post(`${BASE}/`, payload)
  return response.data
}

export async function deleteRole(roleId: number): Promise<{ detail: string }> {
  const response = await clientHttp.delete(`${BASE}/${roleId}`)
  return response.data
}

export async function reorderRoles(payload: { items: Array<{ role_id: number; rank_order: number }> }): Promise<RoleOut[]> {
  const response = await clientHttp.patch(`${BASE}/reorder`, payload)
  return Array.isArray(response.data) ? response.data : []
}
