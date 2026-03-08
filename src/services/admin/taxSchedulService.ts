import http, { getAccessToken } from '@/services/http';
import { TaxSchedule } from '@/types/taxSchedule';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

function authHeaders() {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// companyId가 없으면 전체 조회, 있으면 특정 회사 조회
export async function fetchTaxSchedules(companyId?: number): Promise<TaxSchedule[]> {
const url = companyId 
    ? `${BASE}/tax-schedule/admin?company_id=${companyId}` 
    : `${BASE}/tax-schedule/admin`;

  const response = await http.get<TaxSchedule[]>(url, {
    headers: authHeaders(),
  });
  return response.data;
}

export async function updateTaxScheduleStatus(
  scheduleId: number,
  status: 'SCHEDULED' | 'COMPLETED'
): Promise<TaxSchedule> {
  const response = await http.patch<TaxSchedule>(
    `${BASE}/tax-schedule/${scheduleId}/status`,
    { status },
    {
      headers: authHeaders(),
    }
  )
  return response.data
}
