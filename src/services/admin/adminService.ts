import http, { clearAdminAccessToken, getAdminAccessToken, setAdminAccessToken } from '@/services/http'
import type {
  LoginRequest,
  LoginResponse,
  AdminSession,
  AdminOut
} from '@/types/admin'

const ADMIN_BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin`
const ADMIN_AUTH_BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin`

function getAdminRank(raw: any): number | null {
  if (typeof raw?.rank_order === 'number') return raw.rank_order
  if (typeof raw?.role_level === 'number') return raw.role_level
  if (typeof raw?.role?.rank_order === 'number') return raw.role.rank_order
  return null
}

function normalizeAdminSession<T extends Record<string, any>>(raw: T): T {
  const rank = getAdminRank(raw)
  const nextRole = raw?.role && typeof raw.role === 'object'
    ? {
        ...raw.role,
        rank_order: typeof raw.role.rank_order === 'number' ? raw.role.rank_order : rank ?? undefined,
      }
    : raw?.role

  return {
    ...raw,
    role: nextRole,
    role_level: rank ?? raw?.role_level,
    rank_order: rank ?? raw?.rank_order,
  }
}

// 공통 인증 헤더 함수
function authHeader() {
  const token = getAdminAccessToken()
  return {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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
  const res = await http.post(`${ADMIN_AUTH_BASE}/login`, data)
  const { access_token, ...rest } = res.data as any
  const adminInfo = normalizeAdminSession(rest?.admin ?? rest)
  if (access_token) setAdminAccessToken(access_token)
  return { access_token, admin: adminInfo };
}

// ─────────────────────────────────────────────────────────────────────────
// 관리자 세션 확인
export async function checkAdminSession(access_token?: string): Promise<AdminSession> {
  try {
    if (access_token) setAdminAccessToken(access_token)

    const res = await http.get<AdminSession & { access_token?: string }>(`${ADMIN_AUTH_BASE}/session`, {
      timeout: 5000,
    })

    const session = res.data as any
    if (!session || typeof session !== 'object') {
      throw new Error("세션 정보가 유효하지 않음")
    }
    if (typeof session.name !== 'string') {
      throw new Error('세션 사용자 정보(name)가 없습니다.')
    }

    if (session.access_token) {
      setAdminAccessToken(session.access_token)
    }

    return normalizeAdminSession(session)
  } catch (error) {
    console.warn("❌ 세션 확인 실패:", error)
    throw error
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 관리자 로그아웃

export async function logoutAdmin(): Promise<{ message: string }> {
  const res = await http.post(`${ADMIN_AUTH_BASE}/logout`)
  clearAdminAccessToken()
  return res.data as { message: string }
}



// ─────────────────────────────────────────────────────────────────────────
// ✅ 관리자 세션 확인
export async function fetchAdminSession(): Promise<AdminSession> {
  const res = await http.get(`${ADMIN_AUTH_BASE}/session`, authHeader())
  return res.data
}

export async function changeAdminPassword(payload: {
  current_password: string
  new_password: string
}): Promise<{ message: string }> {
  const res = await http.patch<{ message: string }>(`${ADMIN_AUTH_BASE}/password`, payload, authHeader())
  return res.data
}

export async function uploadMyProfileImage(file: File): Promise<{ message: string; profile_image_url?: string | null }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await http.put<{ message: string; profile_image_url?: string | null }>(`${ADMIN_AUTH_BASE}/me/profile-image`, formData, {
    ...authHeader(),
    headers: {
      ...authHeader().headers,
      'Content-Type': 'multipart/form-data',
    },
  })
  return res.data
}

export async function deleteMyProfileImage(): Promise<{ message: string }> {
  const res = await http.delete<{ message: string }>(`${ADMIN_AUTH_BASE}/me/profile-image`, authHeader())
  return res.data
}
