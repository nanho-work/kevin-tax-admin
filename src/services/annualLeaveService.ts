import axios from 'axios';
import type { AnnualLeaveResponse } from '@/types/annualLeave';

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin`

// ✅ 공통 인증 헤더 함수
function authHeader() {
    const token = localStorage.getItem('admin_access_token')
    return {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }
}

interface FetchAnnualLeavesParams {
    year?: number;
    keyword?: string;
    offset?: number;
    limit?: number;
}

export async function fetchAnnualLeaves(
    params?: FetchAnnualLeavesParams
): Promise<AnnualLeaveResponse> {
    const res = await axios.get(`${BASE}/annual-leaves`, {
        params,
        ...authHeader(),
    });
    return res.data;
}