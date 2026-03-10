export type AnnualLeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'canceled' | 'approved_canceled'
export type AnnualLeaveCancelStatus = 'none' | 'pending' | 'approved' | 'rejected'

export interface AnnualLeaveRequest {
  id: number
  client_id: number
  admin_id: number
  admin_name: string | null
  start_date: string
  end_date: string
  days: number
  occurred_on: string
  reason: string | null
  status: AnnualLeaveRequestStatus
  cancel_status: AnnualLeaveCancelStatus
  cancel_reason: string | null
  cancel_requested_at: string | null
  cancel_requested_by_admin_id: number | null
  cancel_review_note: string | null
  cancel_reviewed_at: string | null
  cancel_reviewed_by_client_account_id: number | null
  cancel_ledger_entry_id: number | null
  approved_by_admin_id: number | null
  approved_by_client_account_id: number | null
  approved_at: string | null
  reject_reason: string | null
  ledger_entry_id: number | null
  created_at: string
  updated_at: string
}

export interface AnnualLeaveRequestListResponse {
  items: AnnualLeaveRequest[]
  total: number
  page: number
  limit: number
}

export interface CreateAnnualLeaveRequestPayload {
  start_date: string
  end_date: string
  days: number
  occurred_on?: string
  reason?: string
}

export interface ReviewAnnualLeaveRequestPayload {
  action: 'approved' | 'rejected'
  reject_reason?: string
}

export interface CancelAnnualLeaveRequestPayload {
  reason: string
}

export interface CancelReviewAnnualLeaveRequestPayload {
  action: 'approved' | 'rejected'
  review_note?: string
}
