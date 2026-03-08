// services/roleService.ts
import axios from "axios";
import type { RoleCreate, RoleOut } from "@/types/role";


const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/roles`


// 공통 인증 헤더 함수
function authHeader() {
  const token = localStorage.getItem('admin_access_token')
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
}


export async function getRoles(): Promise<RoleOut[]> {
  const response = await axios.get(`${BASE}/`, authHeader());
  const rows = Array.isArray(response.data) ? response.data : []
  return rows.map((row) => {
    const rank =
      typeof row?.rank_order === 'number'
        ? row.rank_order
        : typeof row?.level === 'number'
          ? row.level
          : undefined
    return {
      ...row,
      rank_order: rank,
      level: rank,
    } as RoleOut
  })
}

export async function createRole(data: RoleCreate): Promise<RoleOut> {
  const rank =
    typeof data.rank_order === 'number'
      ? data.rank_order
      : typeof data.level === 'number'
        ? data.level
        : undefined
  const payload = {
    ...data,
    rank_order: rank,
    level: rank,
  }
  const response = await axios.post(`${BASE}/`, payload);
  return response.data;
}

export async function deleteRole(roleId: number): Promise<{ detail: string }> {
  const response = await axios.delete(`${BASE}/${roleId}`, authHeader());
  return response.data;
}
