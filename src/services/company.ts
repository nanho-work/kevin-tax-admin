// ✅ lib/api/admin/company.ts
import axios from 'axios'
import type { CompanyTaxDetail, CompanyDetailResponse, CompanyUpdateRequest,
  WithholdingTaxDetailRequest, WithholdingTaxDetailResponse, FinancialStatementRequest,
  FinancialStatementResponse, CorporateTaxDetailRequest, CorporateTaxDetailResponse, PaginatedResponse} from '@/types/admin_campany';

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/company`

function authHeader() {
  const token = localStorage.getItem('admin_access_token')
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
}

interface FetchCompanyParams {
  page: number;
  limit: number;
  keyword?: string;
  category?: string;
}

// ------------------------------
// 회사 정보 통합 조회 (프론트용)
// ------------------------------
export async function fetchCompanyTaxList({
  page,
  limit,
  keyword,

}: FetchCompanyParams): Promise<PaginatedResponse<CompanyTaxDetail>> {
  const response = await axios.get<PaginatedResponse<CompanyTaxDetail>>(`${BASE}/tax-info`, {
    params: { page, limit, keyword },
    ...authHeader()
  });
  return response.data;
}

// ------------------------------
// 회사 소프트 삭제
// ------------------------------
export async function deactivateCompany(
  company_id: number
): Promise<{ message: string }> {
  const res = await axios.delete<{ message: string }>(`${BASE}/delete/${company_id}`, {
    ...authHeader()
    
  })
  return res.data
}

// ------------------------------
// 회사 상세 정보 
// ------------------------------
export async function fetchCompanyDetail(company_id: number): Promise<CompanyDetailResponse> {
  const res = await axios.get<CompanyDetailResponse>(`${BASE}/detail/${company_id}`, {
    ...authHeader()
  })
  return res.data
}

// ------------------------------
// 회사 상세 정보 수정
// ------------------------------

/**
 * 회사 정보 수정 요청
 * @param company_id 수정 대상 회사의 ID
 * @param payload 수정할 필드들을 포함한 객체
 * @returns 서버 응답 메시지
 */
export async function updateCompany(
  company_id: number,
  payload: CompanyUpdateRequest
): Promise<{ message: string }> {
  const res = await axios.patch<{ message: string }>(`${BASE}/update/${company_id}`, payload);
  return res.data;
}


/**
 * 회사 등록 요청
 * @param data CompanyUpdateRequest 형식의 등록 요청 데이터
 * @returns 등록된 회사의 간단한 정보 (CompanyDetailResponse)
 */
export async function createCompany(
  payload: CompanyUpdateRequest
): Promise<{ message: string }> {
  const res = await axios.post<{ message: string }>(`${BASE}/create`, payload);
  return res.data;
}

// ──────────────────────────────────────────────
// 📘 원찬세 관련 API
// ──────────────────────────────────────────────
// 1. 원천세 목록 조회 (전체 또는 회사별)
export async function fetchWithholdingTaxList(
  companyId?: number
): Promise<WithholdingTaxDetailResponse[]> {
  const res = await axios.get<WithholdingTaxDetailResponse[]>(
    `${BASE}/tab/WithholdingTaxDetail`,
    { params: companyId ? { company_id: companyId } : {
      ...authHeader(),
    } }
  )
  return res.data
}

// 2. 원천세 등록
export async function createWithholdingTax(
  payload: WithholdingTaxDetailRequest
): Promise<WithholdingTaxDetailResponse> {
  const res = await axios.post<WithholdingTaxDetailResponse>(
    `${BASE}/tab/WithholdingTaxDetail/create`,
    payload
  )
  return res.data
}

// 3. 원천세 수정
export async function updateWithholdingTax(
  id: number,
  payload: WithholdingTaxDetailRequest
): Promise<WithholdingTaxDetailResponse> {
  const res = await axios.patch<WithholdingTaxDetailResponse>(
    `${BASE}/tab/WithholdingTaxDetail/patch/${id}`,
    payload
  )
  return res.data
}

// 4. 원천세 삭제 (복수 삭제용)
export async function deleteWithholdingTax(ids: number[]): Promise<{ message: string }> {
  const query = ids.map(id => `ids=${id}`).join('&');
  const res = await axios.delete<{ message: string }>(
    `${BASE}/tab/WithholdingTaxDetail/delete/bulk?${query}`
  );
  return res.data;
}

// ──────────────────────────────────────────────
// 📘 재무제표 관련 API
// ──────────────────────────────────────────────

// ✅ 재무제표 전체 or 회사별 목록 조회
export async function fetchFinancialStatements(
  companyId?: number
): Promise<FinancialStatementResponse[]> {
  const res = await axios.get<FinancialStatementResponse[]>(`${BASE}/tab/FinancialStatement`, {
    params: companyId ? { company_id: companyId } : {},
    ...authHeader(),
    
  })
  return res.data
}

// ✅ 재무제표 등록
export async function createFinancialStatement(
  payload: FinancialStatementRequest
): Promise<FinancialStatementResponse> {
  const res = await axios.post<FinancialStatementResponse>(
    `${BASE}/tab/FinancialStatement/create`,
    payload
  )
  return res.data
}

// ✅ 재무제표 수정
export async function updateFinancialStatement(
  id: number,
  payload: FinancialStatementRequest
): Promise<FinancialStatementResponse> {
  const res = await axios.patch<FinancialStatementResponse>(
    `${BASE}/tab/FinancialStatement/patch/${id}`,
    payload
  )
  return res.data
}

// 4. 원천세 삭제 (복수 삭제용)
export async function deleteFinancialStatement(ids: number[]): Promise<{ message: string }> {
  const query = ids.map(id => `ids=${id}`).join('&');
  const res = await axios.delete<{ message: string }>(
    `${BASE}/tab/FinancialStatement/delete/bulk?${query}`
  );
  return res.data;
}


// ──────────────────────────────────────────────
// 📘 법인세 관련 API
// ──────────────────────────────────────────────

// ✅ 법인세 전체 or 회사별 목록 조회
export async function fetchCorporateTaxDetails(
  companyId?: number
): Promise<CorporateTaxDetailResponse[]> {
  const res = await axios.get<CorporateTaxDetailResponse[]>(`${BASE}/tab/CorporateTaxDetail`, {
    params: companyId ? { company_id: companyId } : {},
    ...authHeader(),
  })
  return res.data
}

// ✅ 법인세 등록
export async function createCorporateTaxDetail(
  payload: CorporateTaxDetailRequest
): Promise<CorporateTaxDetailResponse> {
  const res = await axios.post<CorporateTaxDetailResponse>(
    `${BASE}/tab/CorporateTaxDetail/create`,
    payload
  )
  return res.data
}

// ✅ 법인세 수정
export async function updateCorporateTaxDetail(
  id: number,
  payload: CorporateTaxDetailRequest
): Promise<CorporateTaxDetailResponse> {
  const res = await axios.patch<CorporateTaxDetailResponse>(
    `${BASE}/tab/CorporateTaxDetail/patch/${id}`,
    payload
  )
  return res.data
}

export async function deleteCorporateTaxDetail(ids: number[]): Promise<{ message: string }> {
  const query = ids.map(id => `ids=${id}`).join('&');
  const res = await axios.delete<{ message: string }>(
    `${BASE}/tab/CorporateTaxDetail/delete/bulk?${query}`
  );
  return res.data;
}
