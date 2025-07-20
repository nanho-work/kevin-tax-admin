
import type { ClientOut } from "./Client";
import type { TeamOut } from "./team";
import type { RoleOut } from "./role";


// ✅ 로그인 요청 시 사용되는 타입
// 클라이언트가 로그인 시 서버에 전달하는 이메일과 비밀번호 정보를 담습니다.
export interface LoginRequest {
  email: string            // 로그인 이메일
  password: string         // 로그인 비밀번호
}

// ✅ 로그인 성공 시 서버로부터 받는 응답 타입
// 서버가 로그인 성공 시 발급하는 토큰 및 관리자 정보를 포함합니다.
export interface LoginResponse {
  access_token: string
  token_type: "bearer"
  admin: AdminOut
}

export interface AdminOut {
  id: number
  name: string
  email: string
  phone?: string
  is_active: boolean
  last_login_at?: string
  profile_image_url?: string
  hired_at?: string
  retired_at?: string
  client_id: number
  team_id?: number
  team?: TeamOut | null
  role_id?: number
  role?: RoleOut | null
  client?: ClientOut | null
}

export interface AdminSession {
  id: number
  name: string
  email: string
  is_active: boolean
  last_login_at: string
  profile_image_url?: string
  hired_at?: string
  retired_at?: string
  client_id: number
  team_id?: number
  team?: TeamOut | null
  role_id?: number
  role?: RoleOut | null
  client?: ClientOut | null
}

// ✅ 관리자 생성 요청 - 등록 시 서버에 전송하는 타입
export interface CreateStaffRequest {
  email: string
  name: string
  password: string
  phone?: string
  client_id: number;
  hired_at?: string
  profile_image_url?: string
  team_id?: number           // 🔼 추가 필요
  role_id?: number           // 🔼 변경 필요
}

// ✅ 관리자 수정 요청 - 수정 시 서버에 전송하는 타입
export interface UpdateStaffRequest {
  name?: string
  phone?: string
  profile_image_url?: File | string
  hired_at?: string
  retired_at?: string
  team_id?: number           // 🔼 추가 필요
  role_id?: number           // 🔼 변경 필요
}
