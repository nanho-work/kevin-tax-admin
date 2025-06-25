// ✅ 로그인 요청 시 사용되는 타입
// 클라이언트가 로그인 시 서버에 전달하는 이메일과 비밀번호 정보를 담습니다.
export interface LoginRequest {
  email: string            // 로그인 이메일
  password: string         // 로그인 비밀번호
}

// ✅ 로그인 성공 시 서버로부터 받는 응답 타입
// 서버가 로그인 성공 시 발급하는 토큰 및 관리자 정보를 포함합니다.
export interface LoginResponse {
  access_token: string     // Access Token (JWT)
  refresh_token: string    // Refresh Token
  token_type: string       // ex: "Bearer"
  admin_id: number         // 로그인한 관리자 ID
  email: string            // 로그인한 관리자 이메일
  role: AdminRole          // 관리자 권한 (STAFF / MANAGER / SUPER)
}

// ✅ 관리자 권한 타입 정의
// 시스템 내 관리자 권한은 3단계로 구분됨
export type AdminRole = 'STAFF' | 'MANAGER' | 'SUPER'

export interface AdminSession {
  id: number
  email: string
  role: AdminRole
  is_active: boolean
  last_login_at: string // ISO 포맷 문자열
}