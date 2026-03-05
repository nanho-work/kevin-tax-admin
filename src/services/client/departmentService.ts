import { clientHttp } from '@/services/http'
import type { DepartmentCreate, DepartmentOut } from '@/types/department'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/departments`

export async function getDepartments(): Promise<DepartmentOut[]> {
  const response = await clientHttp.get(`${BASE}/`)
  return response.data
}

export async function createDepartment(data: DepartmentCreate): Promise<DepartmentOut> {
  const response = await clientHttp.post(`${BASE}/`, data)
  return response.data
}

export async function deleteDepartment(departmentId: number): Promise<{ detail: string }> {
  const response = await clientHttp.delete(`${BASE}/${departmentId}`)
  return response.data
}
