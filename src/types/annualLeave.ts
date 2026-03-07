export interface AnnualLeave {
  id: number;
  admin_id: number;
  admin_name: string;
  grant_date: string;      // ISO Date string
  granted_days: number;
  used_days: number;
  consumed_days: number;
  remaining_days: number;
  expired_at: string | null;
  is_closed: boolean;
  memo: string | null;
}

export interface AnnualLeaveResponse {
  items: AnnualLeave[];
  total: number;
  page: number;
  limit: number;
}

export interface AnnualLeaveListParams {
  year?: number
  keyword?: string
  offset?: number
  limit?: number
}

export interface AnnualLeaveUseRequest {
  admin_id: number
  days: number
  occurred_on?: string
  reason?: string
  memo?: string
}

export interface AnnualLeaveAdjustRequest {
  admin_id: number
  days: number
  occurred_on?: string
  reason?: string
  memo?: string
}

export interface AnnualLeaveAutoGrantResponse {
  message: string
  total_processed: number
}

export interface AnnualLeaveUseResponse {
  message: string
  admin_id: number
  used_days: number
  occurred_on: string
}

export interface AnnualLeaveAdjustResponse {
  message: string
  admin_id: number
  adjust_days: number
  occurred_on: string
}

export interface AnnualLeaveExpireResponse {
  message: string
  base_date: string
  expired_rows: number
  expired_days_sum: number
}
