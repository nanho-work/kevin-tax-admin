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
  return response.data;
}

export async function createRole(data: RoleCreate): Promise<RoleOut> {
  const response = await axios.post(`${BASE}/`, data);
  return response.data;
}

export async function deleteRole(roleId: number): Promise<{ detail: string }> {
  const response = await axios.delete(`${BASE}/${roleId}`, authHeader());
  return response.data;
}