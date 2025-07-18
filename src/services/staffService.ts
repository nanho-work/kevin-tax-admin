import axios from 'axios'
import type {
  Admin,
} from '@/types/staff'


const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin`

// ✅ 공통 인증 헤더 함수
function authHeader() {
  const token = localStorage.getItem('admin_access_token')
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

// ✅ 관리자 세션 확인
export async function fetchAdminSession(): Promise<Admin> {
  const res = await axios.get(`${BASE}/session`, authHeader())
  return res.data
}

// ✅ 관리자(직원) 목록 조회 (검색 + 페이징 포함)
// - GET /api/admin/staffs?offset=0&limit=20&keyword=xxx
export async function fetchAdminStaffs(
  page: number = 1,
  limit: number = 20,
  keyword?: string
): Promise<PaginatedResponse<Admin>> {
  const offset = (page - 1) * limit
  const params: Record<string, any> = { offset, limit }
  if (keyword) params.keyword = keyword

  const res = await axios.get(`${BASE}/staffs`, {
    params,
    ...authHeader(),
  })
  return res.data
}

// ✅ 관리자(직원) 등록
// - POST /api/admin/staffs
export async function createAdminStaff(
  data: FormData
): Promise<{ message: string; id: number; email: string; role: string }> {
  const res = await axios.post(`${BASE}/staffs`, data, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('admin_access_token')}`,
      'Content-Type': 'multipart/form-data',
    },
  })
  return res.data
}

// ✅ 관리자(직원) 정보 수정
// - PUT /api/admin/staffs/{id}
export async function updateAdminStaff(
  id: number,
  data: FormData
): Promise<{ message: string }> {
  const res = await axios.put(`${BASE}/staffs/${id}`, data, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('admin_access_token')}`,
      'Content-Type': 'multipart/form-data',
    },
  })
  return res.data
}

// ✅ 관리자(직원) 비활성화 처리
// - DELETE /api/admin/staffs/{id}
export async function deactivateAdminStaff(
  id: number
): Promise<{ message: string }> {
  const res = await axios.delete(`${BASE}/staffs/${id}`, authHeader())
  return res.data
}

// ✅ 관리자(직원) 활성화 처리
// - PUT /api/admin/staffs/{id}/activate
export async function activateAdminStaff(
  id: number
): Promise<{ message: string }> {
  const res = await axios.put(`${BASE}/staffs/${id}/activate`, undefined, authHeader())
  return res.data
}

