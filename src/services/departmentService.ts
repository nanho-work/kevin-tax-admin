// services/departmentService.ts
import axios from "axios";
import type { DepartmentCreate, DepartmentOut } from "@/types/department";

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/departments`


// 공통 인증 헤더 함수
function authHeader() {
  const token = localStorage.getItem('admin_access_token')
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
}

export async function getDepartments(): Promise<DepartmentOut[]> {
  const response = await axios.get(`${BASE}/`, authHeader());
  return response.data;
}

export async function createDepartment(data: DepartmentCreate): Promise<DepartmentOut> {
  const response = await axios.post(`${BASE}/`, data);
  return response.data;
}

export async function deleteDepartment(departmentId: number): Promise<{ detail: string }> {
  const response = await axios.delete(`${BASE}/${departmentId}`, authHeader());
  return response.data;
}