import { clientHttp } from '@/services/http'
import type { AttendanceResponse } from '@/types/attendanceLog'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/attendance`

export async function checkInClient(): Promise<AttendanceResponse> {
  const res = await clientHttp.post<AttendanceResponse>(`${BASE}/check-in`, null)
  return res.data
}

export async function checkOutClient(): Promise<AttendanceResponse> {
  const res = await clientHttp.post<AttendanceResponse>(`${BASE}/check-out`, {})
  return res.data
}
