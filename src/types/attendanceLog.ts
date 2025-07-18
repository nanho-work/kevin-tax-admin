// ✅ 출퇴근 로그 단일 항목 (백엔드 AttendanceLogOut 기준)
export interface AttendanceLog {
  id: number
  admin_id: number
  client_id: number
  admin_name: string | null
  date: string
  check_in: string | null
  check_out: string | null
  memo: string | null
  created_at: string
  updated_at: string
}

export interface AttendanceLogListResponse {
  items: AttendanceLog[]
  total: number
  page: number
  limit: number
}

export interface AttendanceResponse {
  message: string
  attendance_log_id: number
}