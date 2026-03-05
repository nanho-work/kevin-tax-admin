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

export interface MessageOut {
  message: string
}
