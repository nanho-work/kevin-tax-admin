

// ✅ 관리자(직원) 정보 - 조회 시 사용되는 응답 타입
export interface Admin {
  id: number
  email: string
  name: string
  phone?: string
  role_id?: number           // 기존: role: AdminRole → 변경 필요
  team_id?: number           // 🔼 추가 필요
  client_id: number          // 🔼 추가 필요
  profile_image_url?: string
  is_active: boolean
  last_login_at?: string | null
  created_at: string
  updated_at: string
  hired_at?: string
  retired_at?: string
}

// ✅ 관리자 생성 요청 - 등록 시 서버에 전송하는 타입
export interface CreateStaffRequest {
  email: string
  name: string
  password: string
  phone?: string
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
