import axios from 'axios'
import type {
  LoginRequest,
  LoginResponse,
  AdminSession
} from '@/types/auth'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin`

/**
 * ✅ 액세스 토큰만 사용하는 구조로 리프레시 토큰 자동 재발급 제거
 * 👉 인터셉터: 제거 또는 최소한 유지
 */
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

/**
 * 관리자 로그인
 */
export async function adminLogin(
  data: LoginRequest
): Promise<{ access_token: string; admin: Omit<LoginResponse, 'access_token' | 'token_type'> }> {
  const res = await axios.post(`${BASE}/login`, data)
  const { access_token, ...adminInfo } = res.data;
  return { access_token, admin: adminInfo };
}

/**
 * 관리자 세션 확인
 */
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

/**
 * 관리자 로그아웃
 */
export async function logoutAdmin(): Promise<{ message: string }> {
  const res = await axios.post(`${BASE}/logout`)
  return res.data as { message: string }
}

