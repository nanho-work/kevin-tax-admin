// ------------------------------
// 회사 정보 통합 조회 타입 (프론트용)
// ------------------------------

// 페이징 처리 ( 공통 )
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface CompanyTaxDetail {
  // 회사 기본 정보
  id: number;                        // 회사 ID
  category?: string;                // 구분 (개인/법인 등)
  company_name: string;            // 사업자명
  owner_name: string;              // 대표자
  manager_name?: string;           // 담당자
  manager_phone?: string;          // 연락처
  manager_email?: string;          // 이메일
  contact_method?: string;         // 연락방법
  memo?: string;                   // 업체 특이사항
  registration_number: string;     // 사업자등록번호
  monthly_fee?: number;            // 기장료 (VAT 별도)
  encrypted_hometax_id?: string;   // 홈택스 ID
  encrypted_hometax_pw?: string;   // 홈택스 PW
  contract_date?: string;          // 수임일 (ISO 문자열)
  business_type?: string;          // 업종
  cms_bank_account?: string;       // CMS 이체 통장
  cms_account_number?: string;     // CMS 계좌번호
  cms_transfer_day?: string;       // CMS 이체일

  // 원천세
  is_half_term?: boolean;          // 반기 여부
  salary_date?: string;            // 급여일
  salary_type?: string;            // 급여작성 형태
  w_memo?: string;                 // 원천세 특이사항

  // 부가세
  is_export?: boolean;             // 수출 여부
  is_online?: boolean;             // 온라인 여부
  v_note?: string;                 // 부가세 특이사항
  v_remark?: string;               // 부가세 비고

  // 법인세/종소세
  has_foreign_currency?: boolean;  // 외화 여부
  ct_note?: string;                // 법인세 특이사항
  ct_remark?: string;              // 법인세 비고
}

// ------------------------------
// 회사 상세 정보 응답 타입
// ------------------------------
export interface CompanyDetailResponse {
  // companies 테이블
  id: number
  category?: string
  company_name: string
  owner_name: string
  manager_name?: string
  manager_phone?: string
  manager_email?: string
  contact_method?: string
  memo?: string
  registration_number?: string
  monthly_fee?: number
  encrypted_hometax_id?: string
  encrypted_hometax_pw?: string
  contract_date?: string // ISO date string
  industry_type?: string
  business_type?: string
  cms_bank_account?: string
  cms_account_number?: string
  cms_transfer_day?: string
  phone?: string
  postal_code?: string
  address1?: string
  address2?: string
  founded_date?: string // ISO date string
  homepage_url?: string
  info_agreed?: boolean
  manager_customer_id?: number
  is_active: boolean
  created_at?: string
  updated_at?: string

  // withholding_taxes 테이블
  is_half_term?: boolean
  salary_date?: string
  salary_type?: string
  w_memo?: string

  // vat_taxes 테이블
  is_export?: boolean
  is_online?: boolean
  v_note?: string
  v_remark?: string

  // corporate_taxes 테이블
  has_foreign_currency?: boolean
  ct_note?: string
  ct_remark?: string
}

export interface CompanyUpdateRequest {
  category?: string;
  company_name?: string;
  owner_name?: string;
  manager_name?: string;
  manager_phone?: string;
  manager_email?: string;
  contact_method?: string;
  memo?: string;
  registration_number?: string;
  monthly_fee?: number;
  encrypted_hometax_id?: string;
  encrypted_hometax_pw?: string;
  contract_date?: string; // ISO string (YYYY-MM-DD)
  industry_type?: string;
  business_type?: string;
  cms_bank_account?: string;
  cms_account_number?: string;
  cms_transfer_day?: string;
  phone?: string;
  postal_code?: string;
  address1?: string;
  address2?: string;
  founded_date?: string;
  homepage_url?: string;
  info_agreed?: boolean;
  is_active?: boolean;
  manager_customer_id?: number;

  // 세금 관련
  is_half_term?: boolean;
  salary_date?: string;
  salary_type?: string;
  w_memo?: string;

  is_export?: boolean;
  is_online?: boolean;
  v_note?: string;
  v_remark?: string;

  has_foreign_currency?: boolean;
  ct_note?: string;
  ct_remark?: string;
}


// ------------------------------
// 재무제표 요청
// ------------------------------
export interface FinancialStatementRequest {
  company_id?: number;                      // 연결된 회사 ID
  year?: string;                            // 귀속 연도 (예: "2024")
  open_date?: string;                       // 개업일 (ISO 형식: "YYYY-MM-DD")
  current_assets_cash?: number;             // 당좌자산
  accounts_receivable?: number;             // 매출채권
  short_term_trade_receivables?: number;    // 단기영업채권
  inventory?: number;                       // 재고자산
  current_assets?: number;                  // 유동자산
  tangible_assets?: number;                 // 유형자산
  intangible_assets?: number;               // 무형자산
  other_non_current_assets?: number;        // 기타비유동자산
  non_current_assets?: number;              // 비유동자산
  total_assets?: number;                    // 자산총계
  short_term_trade_liabilities?: number;       // 단기영업부채
  short_term_financial_liabilities?: number;   // 단기금융부채
  current_liabilities?: number;                // 유동부채
  long_term_financial_liabilities?: number;    // 장기금융부채
  non_current_liabilities?: number;            // 비유동부채
  total_liabilities?: number;                  // 부채총계
  related_party_receivables?: number;       // 주임동채권
  related_party_payables?: number;          // 주임종채무
  capital_stock?: number;                   // 자본금
  capital_surplus?: number;                 // 자본잉여금
  capital_adjustment?: number;              // 자본조정
  retained_earnings?: number;               // 미처분이익잉여금(결손금)
  total_equity?: number;                    // 자본총계
  total_liabilities_and_equity?: number;    // 부채 및 자본 총계
  total_liabilities_and_equity_2?: number;  // 부채 및 자본 총계2
  revenue?: number;                         // 매출액
  purchase_cost?: number;                   // 매입원가
  cost_of_goods_sold?: number;              // 매출원가
  gross_profit?: number;                    // 매출총이익
  sg_and_a?: number;                        // 판매비와 관리비
  depreciation?: number;                    // 감가상각비
  amortization?: number;                    // 무형자산상각비
  rent_expense?: number;                    // 임차료
  operating_income?: number;                // 영업이익
  non_operating_income?: number;            // 영업외 수익
  non_operating_expense?: number;           // 영업외 비용
  interest_expense?: number;                // 이자비용
  income_before_tax?: number;               // 법인세 차감 전 손익
  corporate_tax?: number;                   // 법인세
  net_income?: number;                      // 당기순손익
  ebitda?: number;                          // EBITDA
}

// ------------------------------
// 재무제표 응답
// ------------------------------
export interface FinancialStatementResponse {
  id: number;                             // 고유 ID
  company_id: number;                     // 연결된 회사 ID
  company_name?: string;                  // 회사명
  year: string;                           // 귀속연도
  open_date?: string;                     // 개업일 (ISO 날짜 문자열)
  current_assets_cash?: number;
  accounts_receivable?: number;
  short_term_trade_receivables?: number;
  inventory?: number;
  current_assets?: number;
  tangible_assets?: number;
  intangible_assets?: number;
  other_non_current_assets?: number;
  non_current_assets?: number;
  total_assets?: number;
  short_term_trade_liabilities?: number;
  short_term_financial_liabilities?: number;
  current_liabilities?: number;
  long_term_financial_liabilities?: number;
  non_current_liabilities?: number;
  total_liabilities?: number;
  related_party_receivables?: number;
  related_party_payables?: number;
  capital_stock?: number;
  capital_surplus?: number;
  capital_adjustment?: number;
  retained_earnings?: number;
  total_equity?: number;
  total_liabilities_and_equity?: number;
  total_liabilities_and_equity_2?: number;
  revenue?: number;
  purchase_cost?: number;
  cost_of_goods_sold?: number;
  gross_profit?: number;
  sg_and_a?: number;
  depreciation?: number;
  amortization?: number;
  rent_expense?: number;
  operating_income?: number;
  non_operating_income?: number;
  non_operating_expense?: number;
  interest_expense?: number;
  income_before_tax?: number;
  corporate_tax?: number;
  net_income?: number;
  ebitda?: number;

  created_at?: string; // ISO 8601 datetime string (e.g. "2024-06-01T12:34:56")
}

// ------------------------------
// 원천세 상세 정보 응답
// ------------------------------
export interface WithholdingTaxDetailResponse {
  id: number;
  company_id: number;
  company_name?: string;
  year: string;
  obligation?: string;
  salary_reported?: boolean;
  attribution_month?: string;
  payment_month?: string;
  employee_count?: number;
  employee_amount?: number;
  untaxed_submitted?: number;
  simple_employee?: number;
  daily_worker_count?: number;
  daily_worker_amount?: number;
  daily_worker_filed?: boolean;
  business_worker_count?: number;
  business_worker_amount?: number;
  simple_business?: boolean;
  etc_worker_count?: number;
  etc_worker_amount?: number;
  retirement_count?: number;
  retirement_amount?: number;
  created_at?: string; // ISO 8601 datetime string
}

// ------------------------------
// 원천세 상세 정보 요청
// ------------------------------
export interface WithholdingTaxDetailRequest {
  company_id?: number;
  year?: string;
  obligation?: string;
  salary_reported?: boolean;
  attribution_month?: string;
  payment_month?: string;
  employee_count?: number;
  employee_amount?: number;
  untaxed_submitted?: number;
  simple_employee?: number;
  daily_worker_count?: number;
  daily_worker_amount?: number;
  daily_worker_filed?: boolean;
  business_worker_count?: number;
  business_worker_amount?: number;
  simple_business?: boolean;
  etc_worker_count?: number;
  etc_worker_amount?: number;
  retirement_count?: number;
  retirement_amount?: number;
}

// ------------------------------
// 법인세 상세 응답 타입
// ------------------------------
export interface CorporateTaxDetailResponse {
  id: number;
  company_id: number;
  company_name?: string;
  year: string;

  net_income_reported?: number;

  income1?: string;
  income_amount1?: number;
  income2?: string;
  income_amount2?: number;
  income3?: string;
  income_amount3?: number;
  income4?: string;
  income_amount4?: number;
  income_total?: number;

  deduction1?: string;
  deduction_amount1?: number;
  deduction2?: string;
  deduction_amount2?: number;
  deduction3?: string;
  deduction_amount3?: number;
  deduction4?: string;
  deduction_amount4?: number;
  deduction_total?: number;

  adjusted_income?: number;
  donation_adjustment?: number;
  taxable_income?: number;
  loss_carried_forward?: number;
  tax_base?: number;
  tax_rate?: string;
  calculated_tax?: number;

  tax_credit_name1?: string;
  tax_credit_amount1?: number;
  tax_credit_name2?: string;
  tax_credit_amount2?: number;
  tax_credit_name3?: string;
  tax_credit_amount3?: number;
  tax_credit_name4?: string;
  tax_credit_amount4?: number;
  total_tax_credits?: number;

  additional_tax?: number;
  tax_adjusted?: number;
  prepaid_tax?: number;
  additional_tax_reduced?: number;
  total_tax_due?: number;

  minimum_tax?: number;
  local_tax?: number;
  rural_special_tax?: number;

  created_at?: string; // ISO 형식의 날짜 문자열
}

// ------------------------------
// 법인세 상세 요청 타입
// ------------------------------
export interface CorporateTaxDetailRequest {
  company_id?: number;
  year?: string;
  net_income_reported?: number;

  income1?: string;
  income_amount1?: number;
  income2?: string;
  income_amount2?: number;
  income3?: string;
  income_amount3?: number;
  income4?: string;
  income_amount4?: number;
  income_total?: number;

  deduction1?: string;
  deduction_amount1?: number;
  deduction2?: string;
  deduction_amount2?: number;
  deduction3?: string;
  deduction_amount3?: number;
  deduction4?: string;
  deduction_amount4?: number;
  deduction_total?: number;

  adjusted_income?: number;
  donation_adjustment?: number;
  taxable_income?: number;
  loss_carried_forward?: number;
  tax_base?: number;
  tax_rate?: string;
  calculated_tax?: number;

  tax_credit_name1?: string;
  tax_credit_amount1?: number;
  tax_credit_name2?: string;
  tax_credit_amount2?: number;
  tax_credit_name3?: string;
  tax_credit_amount3?: number;
  tax_credit_name4?: string;
  tax_credit_amount4?: number;
  total_tax_credits?: number;

  additional_tax?: number;
  tax_adjusted?: number;
  prepaid_tax?: number;
  additional_tax_reduced?: number;
  total_tax_due?: number;

  minimum_tax?: number;
  local_tax?: number;
  rural_special_tax?: number;
}