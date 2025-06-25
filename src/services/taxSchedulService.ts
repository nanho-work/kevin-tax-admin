import axios from 'axios';
import { TaxSchedule } from '@/types/taxSchedule';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// companyId가 없으면 전체 조회, 있으면 특정 회사 조회
export async function fetchTaxSchedules(companyId?: number): Promise<TaxSchedule[]> {
const url = companyId 
    ? `${BASE}/tax-schedule/admin?company_id=${companyId}` 
    : `${BASE}/tax-schedule/admin`;

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_access_token') : '';

  const response = await axios.get<TaxSchedule[]>(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
}