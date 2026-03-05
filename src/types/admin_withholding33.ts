export type WithholdingReviewStatus = 'draft' | 'reviewed' | 'rejected' | 'filed'
export type WithholdingReviewTargetStatus = 'reviewed' | 'rejected' | 'filed'

export interface AdminWithholding33Item {
  id: number
  company_id: number
  contractor_id: number
  target_month: string
  pay_date?: string | null
  gross_pay: number
  income_tax: number
  local_tax: number
  net_pay: number
  review_status: WithholdingReviewStatus
  reviewed_at?: string | null
  reviewed_by_admin_id?: number | null
  filed_at?: string | null
  filed_by_admin_id?: number | null
  review_note?: string | null
  created_at: string
  updated_at?: string | null
  company_name?: string | null
  registration_number?: string | null
  contractor_name?: string | null
  contractor_rrn?: string | null
}

export interface AdminWithholding33ListResponse {
  total: number
  page: number
  size: number
  items: AdminWithholding33Item[]
}

export interface AdminWithholding33ListParams {
  company_id?: number
  target_month?: string
  review_status?: WithholdingReviewStatus
  contractor_id?: number
  q?: string
  page?: number
  size?: number
}

export interface AdminWithholding33ReviewPayload {
  status: WithholdingReviewTargetStatus
  note?: string
}

export interface AdminWithholding33ReviewResponse {
  message: string
  payment_id: number
  review_status: WithholdingReviewStatus
  reviewed_at?: string | null
  filed_at?: string | null
}
