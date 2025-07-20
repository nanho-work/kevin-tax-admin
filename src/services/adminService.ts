import axios from 'axios'
import type {
  LoginRequest,
  LoginResponse,
  AdminSession,
  AdminOut,
  CreateStaffRequest,
  UpdateStaffRequest
} from '@/types/admin'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin`

// ─────────────────────────────────────────────────────────────────────────
// 액세스 토큰만 사용하는 구조로 리프레시 토큰 자동 재발급 제거
// 인터셉터: 제거 또는 최소한 유지
axios.interceptors.response.use(
  response => response,
  async error => {
    // ❌ 리프레시 토큰 요청 제거
    if (
      error.response?.status === 401 &&
      !error.config?._retry &&
      !error.config?.url?.includes('/login') &&
      !error.config?.url?.includes('/session')
    ) {
      console.warn("401 Unauthorized - 재로그인 필요")
    }

    return Promise.reject(error)
  }
)
// ─────────────────────────────────────────────────────────────────────────
// 공통 인증 헤더 함수
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

// ─────────────────────────────────────────────────────────────────────────
// 관리자 로그인

export async function adminLogin(
  data: LoginRequest
): Promise<{ access_token: string; admin: Omit<LoginResponse, 'access_token' | 'token_type'> }> {
  const res = await axios.post(`${BASE}/login`, data)
  const { access_token, ...adminInfo } = res.data;
  return { access_token, admin: adminInfo };
}

// ─────────────────────────────────────────────────────────────────────────
// 관리자 세션 확인
export async function checkAdminSession(access_token?: string): Promise<AdminSession> {
  try {
    const token = access_token ?? localStorage.getItem('admin_access_token')

    const res = await axios.get<AdminSession>(`${BASE}/session`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      timeout: 5000,
    })

    if (!res.data || !res.data.role_id) {
      throw new Error("세션 정보가 유효하지 않음")
    }

    return res.data // ✅ profile_image_url 포함됨
  } catch (error) {
    console.warn("❌ 세션 확인 실패:", error)
    throw error
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 관리자 로그아웃

export async function logoutAdmin(): Promise<{ message: string }> {
  const res = await axios.post(`${BASE}/logout`)
  return res.data as { message: string }
}



// ─────────────────────────────────────────────────────────────────────────
// ✅ 관리자 세션 확인
export async function fetchAdminSession(): Promise<AdminOut> {
  const res = await axios.get(`${BASE}/session`, authHeader())
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────
// ✅ 관리자(직원) 목록 조회 (검색 + 페이징 포함)
// - GET /api/admin/staffs?offset=0&limit=20&keyword=xxx
export async function getAdminStaffs(
  page: number = 1,
  limit: number = 20,
  keyword?: string
): Promise<PaginatedResponse<AdminOut>> {
  const offset = (page - 1) * limit
  const params: Record<string, any> = { offset, limit }
  if (keyword) params.keyword = keyword

  const res = await axios.get(`${BASE}/staffs`, {
    params,
    ...authHeader(),
  })
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────
// ✅ 관리자(직원) 비활성화 처리
// - DELETE /api/admin/staffs/{id}
export async function deactivateAdminStaff(
  id: number
): Promise<{ message: string }> {
  const res = await axios.delete(`${BASE}/staffs/${id}`, authHeader())
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────
// ✅ 관리자(직원) 활성화 처리
// - PUT /api/admin/staffs/{id}/activate
export async function activateAdminStaff(
  id: number
): Promise<{ message: string }> {
  const res = await axios.put(`${BASE}/staffs/${id}/activate`, undefined, authHeader())
  return res.data
}



