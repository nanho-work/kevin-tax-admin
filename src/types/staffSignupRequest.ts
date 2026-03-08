export type StaffSignupRequestStatus = 'pending' | 'approved' | 'rejected' | 'canceled'

export interface StaffSignupRequest {
  id: number
  client_id: number
  email: string
  name: string
  phone?: string | null
  birth_date?: string | null
  hired_at?: string | null
  initial_remaining_days?: number | null
  team_id?: number | null
  role_id?: number | null
  status: StaffSignupRequestStatus
  approved_admin_id?: number | null
  approved_by_client_account_id?: number | null
  rejected_by_client_account_id?: number | null
  decision_reason?: string | null
  decided_at?: string | null
  privacy_agreed: boolean
  privacy_agreed_at?: string | null
  created_at: string
  updated_at: string
}

export interface StaffSignupRequestListResponse {
  total: number
  items: StaffSignupRequest[]
}

export interface CreateStaffSignupRequestPayload {
  client_id: number
  email: string
  password: string
  name: string
  phone?: string
  birth_date?: string
  hired_at?: string
  initial_remaining_days?: number
  team_id?: number
  role_id?: number
  privacy_agreed: boolean
}

export interface ApproveStaffSignupRequestPayload {
  decision_reason?: string
  team_id?: number
  role_id?: number
}

export interface RejectStaffSignupRequestPayload {
  decision_reason: string
}
