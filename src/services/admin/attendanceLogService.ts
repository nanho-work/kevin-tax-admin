import http, { getAccessToken } from '@/services/http'
import type { AttendanceLog, 
    AttendanceLogListResponse, 
    AttendanceResponse } from '@/types/attendanceLog';



const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/attendance`

function authHeaders() {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ─────────────────────────────────────────────────────────────────────────
// — 근태관리: 출근 기록
// ─────────────────────────────────────────────────────────────────────────
export async function checkInAdmin(): Promise <AttendanceResponse> {
    const res = await http.post(`${BASE}/check-in`, null, {
        headers: authHeaders(),
    })
    return res.data
}

// ─────────────────────────────────────────────────────────────────────────
// — 근태관리: 퇴근 기록
// ─────────────────────────────────────────────────────────────────────────
export async function checkOutAdmin(): Promise <AttendanceResponse> {
    const res = await http.post(`${BASE}/check-out`, {}, {
        headers: authHeaders(),
    })
    return res.data
}

// ─────────────────────────────────────────────────────────────────────────
// — 근태관리: 출, 퇴근 기록 전체조회
// ─────────────────────────────────────────────────────────────────────────
export async function getAttendanceLogs(params: {
  offset?: number
  limit?: number
  admin_id?: number
  date_from?: string
  date_to?: string
  keyword?: string
}): Promise <AttendanceLogListResponse> {
  const res = await http.get(`${BASE}/logs`, {
    params,
    headers: authHeaders(),
  })
  return res.data
}
