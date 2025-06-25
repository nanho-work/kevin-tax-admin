import axios from 'axios'
import type {
  AdminRole,
  LoginRequest,
  LoginResponse,
  AdminSession
} from '@/types/auth'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin`

// ✅ Axios 응답 인터셉터: access_token 만료 시 자동 재발급
axios.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/login') &&
      !originalRequest.url.includes('/token/refresh') &&
      !originalRequest.url.includes('/session')
    ) {
      originalRequest._retry = true
      try {
        const res = await axios.post(`${BASE}/token/refresh`, null, {
          withCredentials: true, // 쿠키 전달 필수
        })
        const newAccessToken = res.data.access_token
        // localStorage 저장 제거: 서버 세션(Cookie) 방식으로 대체
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return axios(originalRequest)
      } catch (refreshError) {
        // localStorage 제거 코드 제거 (서버 세션 방식 사용)
        return Promise.reject(refreshError)
      }
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
  const res = await axios.post(`${BASE}/login`, data, {
    withCredentials: true, // 쿠키 포함
  })
  console.log("🔐 로그인 응답", res);
  const { access_token, ...adminInfo } = res.data;
  return { access_token, admin: adminInfo };
}

/**
 * 관리자 세션 확인 (로그인 유지 및 토큰 유효성 확인)
 */
export async function checkAdminSession(access_token?: string): Promise<AdminSession> {
  try {
    // 🔑 access_token이 인자로 없으면 localStorage에서 가져옴
    const token = access_token ?? localStorage.getItem('admin_access_token')

    const res = await axios.get<AdminSession>(`${BASE}/session`, {
      withCredentials: true, // 서버에 쿠키 자동 포함 (access_token, refresh_token)
      headers: {
        Authorization: `Bearer ${token}` // Note: access_token should be passed to this function
      },
      timeout: 5000, // 응답 대기 최대 시간 (5초)
    })

    // ✅ 서버 응답 전체 로그 출력 (디버깅용)
    console.log("🔍 세션 확인 응답", res)

    // ✅ 응답 데이터가 없거나, role 필드가 없을 경우 오류 처리
    if (!res.data || !res.data.role) {
      throw new Error("세션 정보가 유효하지 않음") // 로그인 유지 불가로 간주
    }

    // ✅ 세션 정보 정상 반환
    return res.data
  } catch (error) {
    // ❌ 예외 발생 시 경고 로그 출력 후 예외 전파
    console.warn("❌ 세션 확인 실패:", error)
    throw error
  }
}

/**
 * 관리자 로그아웃
 */
export async function logoutAdmin(): Promise<{ message: string }> {
  const res = await axios.post(`${BASE}/logout`, null, {
    withCredentials: true, // 쿠키 포함
  })
  return res.data as { message: string }
}