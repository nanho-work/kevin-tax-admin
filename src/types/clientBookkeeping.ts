export type ClientBookkeepingBillingStatus =
  | 'planned'
  | 'invoiced'
  | 'paid'
  | 'partial'
  | 'unpaid'
  | 'canceled'

export interface ClientBookkeepingContractCreateRequest {
  company_id: number
  start_date?: string | null
  end_date?: string | null
  start_month?: string | null
  end_month?: string | null
  monthly_fee_supply?: number | null
  vat_included?: boolean
  is_active?: boolean
  change_reason?: string | null
  memo?: string | null
}

export interface ClientBookkeepingContractUpdateRequest {
  company_id?: number | null
  start_date?: string | null
  end_date?: string | null
  start_month?: string | null
  end_month?: string | null
  monthly_fee_supply?: number | null
  vat_included?: boolean | null
  is_active?: boolean | null
  change_reason?: string | null
  memo?: string | null
}

export interface ClientBookkeepingContractOut {
  id: number
  client_id: number
  company_id: number
  company_name?: string | null
  registration_number?: string | null
  start_date?: string | null
  end_date?: string | null
  start_month?: string | null
  end_month?: string | null
  monthly_fee_supply?: number | null
  vat_included: boolean
  is_active: boolean
  change_reason?: string | null
  changed_by_account_id?: number | null
  version_no: number
  memo?: string | null
  created_at: string
  updated_at: string
}

export interface ClientBookkeepingContractListResponse {
  total: number
  items: ClientBookkeepingContractOut[]
}

export interface ClientBookkeepingContractListFilters {
  is_active?: boolean
  q?: string
}

export interface ClientBookkeepingGenerateBillingsRequest {
  from_month?: string | null
  to_month?: string | null
}

export interface ClientBookkeepingGenerateBillingsResponse {
  contract_id: number
  company_id: number
  from_month: string
  to_month: string
  monthly_fee_supply: number
  vat_amount: number
  total_amount: number
  created_count: number
  skipped_count: number
  created_months: string[]
  skipped_months: string[]
}

export interface ClientBookkeepingBillingCreateRequest {
  company_id: number
  contract_id?: number | null
  target_month: string
  supply_amount?: number
  vat_amount?: number
  total_amount?: number
  invoice_issued_at?: string | null
  cash_received_at?: string | null
  adjustment_amount?: number
  receivable_amount?: number
  status?: ClientBookkeepingBillingStatus
  memo?: string | null
}

export interface ClientBookkeepingBillingUpdateRequest {
  company_id?: number | null
  contract_id?: number | null
  target_month?: string | null
  supply_amount?: number | null
  vat_amount?: number | null
  total_amount?: number | null
  invoice_issued_at?: string | null
  cash_received_at?: string | null
  adjustment_amount?: number | null
  receivable_amount?: number | null
  status?: ClientBookkeepingBillingStatus | null
  memo?: string | null
}

export interface ClientBookkeepingBillingStatusPatchRequest {
  status: ClientBookkeepingBillingStatus
  memo?: string | null
}

export interface ClientBookkeepingBillingInvoiceIssuedAtBulkRequest {
  billing_ids: number[]
  invoice_issued_at: string
}

export interface ClientBookkeepingBillingInvoiceIssuedAtBulkResponse {
  requested_count: number
  updated_count: number
  unchanged_count: number
  not_found_ids: number[]
  invoice_issued_at: string
}

export interface ClientBookkeepingBillingOut {
  id: number
  client_id: number
  company_id: number
  contract_id?: number | null
  company_name?: string | null
  registration_number?: string | null
  target_month: string
  supply_amount: number
  vat_amount: number
  total_amount: number
  invoice_issued_at?: string | null
  cash_received_at?: string | null
  adjustment_amount: number
  receivable_amount: number
  status: ClientBookkeepingBillingStatus
  generated_by: 'manual' | 'contract_auto'
  memo?: string | null
  created_at: string
  updated_at: string
}

export interface ClientBookkeepingBillingListFilters {
  target_month_from?: string
  target_month_to?: string
  company_id?: number
  status?: ClientBookkeepingBillingStatus
  unpaid_only?: boolean
  page?: number
  size?: number
}

export interface ClientBookkeepingBillingListResponse {
  total: number
  page: number
  size: number
  items: ClientBookkeepingBillingOut[]
}

export type ClientBookkeepingUnpaidGroupSort =
  | 'receivable_desc'
  | 'receivable_asc'
  | 'latest_month_desc'
  | 'latest_month_asc'
  | 'company_name_asc'
  | 'company_name_desc'
  | 'billing_count_desc'
  | 'billing_count_asc'

export type ClientBookkeepingMonthSort = 'asc' | 'desc'

export interface ClientBookkeepingUnpaidGroupsFilters {
  page?: number
  size?: number
  status?: ClientBookkeepingBillingStatus
  keyword?: string
  company_id?: number
  sort?: ClientBookkeepingUnpaidGroupSort
  month_sort?: ClientBookkeepingMonthSort
  include_items?: boolean
  item_page?: number
  item_size?: number
}

export interface ClientBookkeepingUnpaidGroupOut {
  company_id: number
  company_name: string
  billing_count: number
  total_receivable_amount: number
  latest_target_month?: string | null
  oldest_target_month?: string | null
}

export interface ClientBookkeepingUnpaidGroupsResponse {
  total_groups: number
  total_receivable_amount_sum: number
  page: number
  size: number
  items: ClientBookkeepingUnpaidGroupOut[]
}

export interface ClientBookkeepingUnpaidGroupItemsFilters {
  page?: number
  size?: number
  month_sort?: ClientBookkeepingMonthSort
}

export interface ClientBookkeepingUnpaidGroupItemsResponse {
  company_id: number
  company_name: string
  total: number
  total_receivable_amount: number
  page: number
  size: number
  items: ClientBookkeepingBillingOut[]
}

export interface ClientBookkeepingMonthlySummaryOut {
  target_month: string
  supply_amount_sum: number
  vat_amount_sum: number
  total_amount_sum: number
  receivable_amount_sum: number
}

export interface ClientBookkeepingSummaryResponse {
  year: number
  items: ClientBookkeepingMonthlySummaryOut[]
}

export interface ClientBookkeepingYearSummaryOut {
  year: number
  supply_amount_sum: number
  vat_amount_sum: number
  total_amount_sum: number
  receivable_amount_sum: number
}

export interface ClientBookkeepingYearsSummaryResponse {
  from_year: number
  to_year: number
  items: ClientBookkeepingYearSummaryOut[]
}

export interface ClientDebitReceiptOut {
  id: number
  batch_id: number
  company_id?: number | null
  company_name?: string | null
  billing_id?: number | null
  target_month?: string | null
  member_name?: string | null
  withdraw_date?: string | null
  withdraw_amount?: number | null
  withdraw_status?: string | null
  created_at: string
}

export interface ClientDebitReceiptListResponse {
  total: number
  page: number
  size: number
  items: ClientDebitReceiptOut[]
}

export interface ClientDebitReceiptListFilters {
  target_month_from?: string
  target_month_to?: string
  company_id?: number
  matched_only?: boolean
  unmatched_only?: boolean
  page?: number
  size?: number
}

export interface ClientDebitReceiptMonthlySummaryOut {
  target_month: string
  received_amount_sum: number
  matched_amount_sum: number
  unmatched_amount_sum: number
  matched_count: number
  unmatched_count: number
}

export interface ClientDebitReceiptSummaryResponse {
  year: number
  items: ClientDebitReceiptMonthlySummaryOut[]
}

export interface ClientBillingSyncReceiptsResponse {
  message: string
  billing_id: number
  attached_count: number
  status: string
  receivable_amount: number
}

export interface ClientDebitUploadBatchOut {
  id: number
  client_id: number
  source_name?: string | null
  file_name?: string | null
  file_key?: string | null
  uploaded_by_admin_id?: number | null
  uploaded_at: string
  total_rows: number
  success_rows: number
  failed_rows: number
  memo?: string | null
}

export interface ClientDebitUploadBatchListResponse {
  total: number
  page: number
  size: number
  items: ClientDebitUploadBatchOut[]
}

export interface ClientDebitUploadBatchListFilters {
  page?: number
  size?: number
}

export interface ClientDebitUploadItemOut {
  id: number
  client_id: number
  batch_id: number
  company_id?: number | null
  billing_id?: number | null
  planned_date?: string | null
  withdraw_date?: string | null
  member_no?: string | null
  member_name?: string | null
  contract_day?: string | null
  requested_amount?: number | null
  withdraw_amount?: number | null
  request_type?: string | null
  withdraw_status?: string | null
  bank_name?: string | null
  account_no_masked?: string | null
  id_no_masked?: string | null
  member_type?: string | null
  manager_name?: string | null
  department_name?: string | null
  registered_at?: string | null
  phone?: string | null
  remark?: string | null
  memo?: string | null
  raw_row_json?: Record<string, unknown> | null
  created_at: string
}

export interface ClientDebitUploadItemListResponse {
  total: number
  page: number
  size: number
  items: ClientDebitUploadItemOut[]
}

export interface ClientDebitUploadItemListFilters {
  withdraw_status?: string
  matched_only?: boolean
  page?: number
  size?: number
}

export interface ClientDebitUploadItemLinkRequest {
  company_id?: number | null
  billing_id?: number | null
}

export interface ClientDebitBatchRematchResponse {
  batch_id: number
  total_items: number
  rematched_count: number
  still_unmatched_count: number
  rematched_item_ids: number[]
}

export interface ClientBookkeepingContractBulkRowResult {
  row_no: number
  company_name?: string | null
  registration_number?: string | null
  start_date?: string | null
  end_date?: string | null
  monthly_fee_supply?: number | null
  vat_included?: boolean | null
  status: string
  reason?: string | null
}

export interface ClientBookkeepingContractBulkPreviewResponse {
  total_rows: number
  valid_rows: number
  invalid_rows: number
  rows: ClientBookkeepingContractBulkRowResult[]
}

export interface ClientBookkeepingContractBulkApplyResponse {
  total_rows: number
  created_count: number
  failed_count: number
  rows: ClientBookkeepingContractBulkRowResult[]
}

export interface MessageOut {
  message: string
}
