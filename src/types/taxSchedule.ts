// src/types/taxSchedule.ts

export interface TaxSchedule {
  id: number;
  company_id?: number;
  company_name: string;
  schedule_type: string;
  due_date: string;
  status: string;
  memo?: string;
  created_at: string;
  updated_at: string;
}