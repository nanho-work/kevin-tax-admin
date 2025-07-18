export interface AnnualLeave {
  id: number;
  admin_id: number;
  admin_name: string;
  grant_date: string;      // ISO Date string
  granted_days: number;
  used_days: number;
  expired_at: string | null;
  memo: string | null;
}

export interface AnnualLeaveResponse {
  items: AnnualLeave[];
  total: number;
  page: number;
  limit: number;
}