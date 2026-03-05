import axios from 'axios'
import type { AttendanceLog, 
    AttendanceLogListResponse, 
    AttendanceResponse } from '@/types/attendanceLog';



const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/attendance`

// ─────────────────────────────────────────────────────────────────────────
// — 근태관리: 출근 기록
// ─────────────────────────────────────────────────────────────────────────
export async function checkInAdmin(): Promise <AttendanceResponse> {
    const token = localStorage.getItem('admin_access_token')
    const res = await axios.post(`${BASE}/check-in`, null, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })
    return res.data
}

// ─────────────────────────────────────────────────────────────────────────
// — 근태관리: 퇴근 기록
// ─────────────────────────────────────────────────────────────────────────
export async function checkOutAdmin(): Promise <AttendanceResponse> {
    const token = localStorage.getItem('admin_access_token')
    const res = await axios.post(`${BASE}/check-out`, {}, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
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
  const token = localStorage.getItem('admin_access_token')
  const res = await axios.get(`${BASE}/logs`, {
    params,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return res.data
}


