import type { AdminRole } from './auth'

// ✅ 관리자(직원) 정보 - 조회 시 사용되는 응답 타입
export interface Admin {
  admin_id: number           // 관리자 고유 ID (DB 기준)
  email: string              // 로그인 이메일
  name: string               // 관리자 이름
  phone?: string             // (선택) 연락처
  role: AdminRole            // 권한 등급: STAFF / MANAGER / SUPER
  is_active: boolean         // 활성 상태 여부
  last_login_at?: string | null // (선택) 마지막 로그인 시각
  created_at: string         // 생성 일시
  updated_at: string         // 수정 일시
}

// ✅ 관리자 생성 요청 - 등록 시 서버에 전송하는 타입
export interface CreateStaffRequest {
  email: string              // 이메일 (필수)
  name: string               // 이름 (필수)
  password: string           // 비밀번호 (필수)
  phone?: string             // (선택) 연락처
  role: 'STAFF' | 'MANAGER'  // SUPER는 직접 생성 불가
}

// ✅ 관리자 수정 요청 - 수정 시 서버에 전송하는 타입
export interface UpdateStaffRequest {
  name?: string              // 이름 (선택 수정)
  phone?: string             // 연락처 (선택 수정)
  role?: 'STAFF' | 'MANAGER' // 권한 (SUPER는 변경 불가)
}