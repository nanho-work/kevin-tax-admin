// ✅ 파일: services/singleTaxService.ts
import axios from 'axios' // ✅ 쿠키 인증이 포함된 axios 인스턴스 사용
import { PaginatedResponse } from '@/types/pagination';
import {
  SingleTaxCreate,
  SingleTaxResponse,
  StatusUpdateRequest,
} from '@/types/single_schedule';

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}`

// 단발성 일정 목록 조회 (페이징)
export const fetchSingleTaxes = async (
  page: number,
  limit: number,
  keyword?: string
): Promise<PaginatedResponse<SingleTaxResponse>> => {
  const params: any = { page, limit };
  if (keyword) params.keyword = keyword;

  const res = await axios.get(`${BASE}/tax-schedule/singletax`, { params });
  return res.data;
};

// 단발성 일정 등록
export const createSingleTax = async (
  payload: SingleTaxCreate
): Promise<SingleTaxResponse> => {
  const res = await axios.post(`${BASE}/tax-schedule/singletax`, payload);
  return res.data;
};

// 단발성 일정 상태 변경
export const updateSingleTaxStatus = async (
  taxId: number,
  payload: StatusUpdateRequest
): Promise<SingleTaxResponse> => {
  const token = localStorage.getItem('admin_access_token');
  const res = await axios.patch(
    `${BASE}/tax-schedule/singletax/${taxId}/status`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return res.data;
};