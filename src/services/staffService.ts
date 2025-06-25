import axios from 'axios'
import type {
  Admin,
  CreateStaffRequest,
  UpdateStaffRequest
} from '@/types/staff'

const BASE = '/api/admin'

// ✅ 모든 관리자(직원) 목록 조회
// - GET /api/admin/staffs
// - 관리자 배열을 반환합니다.
export async function fetchAdminStaffs(): Promise<Admin[]> {
  const res = await axios.get(`${BASE}/staffs`)
  return res.data as Admin[]
}

// ✅ 관리자(직원) 등록
// - POST /api/admin/staffs
// - 이메일, 이름, 비밀번호, 권한(role) 포함
// - 응답: { message, id, email, role }
export async function createAdminStaff(
  data: CreateStaffRequest
): Promise<{ message: string; id: number; email: string; role: string }> {
  const res = await axios.post(`${BASE}/staffs`, data)
  return res.data
}

// ✅ 관리자(직원) 정보 수정
// - PUT /api/admin/staffs/{admin_id}
// - 수정 가능 필드: name, phone, role
// - 응답: { message }
export async function updateAdminStaff(
  admin_id: number,
  data: UpdateStaffRequest
): Promise<{ message: string }> {
  const res = await axios.put(`${BASE}/staffs/${admin_id}`, data)
  return res.data
}

// ✅ 관리자(직원) 비활성화 처리
// - DELETE /api/admin/staffs/{admin_id}
// - 응답: { message }
export async function deactivateAdminStaff(
  admin_id: number
): Promise<{ message: string }> {
  const res = await axios.delete(`${BASE}/staffs/${admin_id}`)
  return res.data
}

// ✅ 관리자(직원) 활성화 처리
// - PUT /api/admin/staffs/{admin_id}/activate
// - 응답: { message }
export async function activateAdminStaff(
  admin_id: number
): Promise<{ message: string }> {
  const res = await axios.put(`${BASE}/staffs/${admin_id}/activate`, undefined)
  return res.data
}