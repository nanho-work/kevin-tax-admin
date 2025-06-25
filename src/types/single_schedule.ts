export type ScheduleTypeEnum = '양도세' | '상속세' | '증여세' | '기타';
export type StatusEnum = 'PENDING' | 'DONE'|'CANCELED';

// 공통 스키마와 동일
export interface SingleTaxBase {
  title: string;
  client_name: string;
  admin_id?: number;
  memo?: string;
  schedule_type: ScheduleTypeEnum;
  due_date?: string; // ISO string (예: 2025-06-24T12:00:00Z)
  status?: StatusEnum;
  completed_at?: string;
}

// ✅ 생성 요청용
export type SingleTaxCreate = SingleTaxBase;

// ✅ 상태 변경용
export interface StatusUpdateRequest {
  status: StatusEnum;
}

// ✅ 응답용
export interface SingleTaxResponse extends SingleTaxBase {
  id: number;
  schedule_type: ScheduleTypeEnum;
  status: StatusEnum;
  created_at: string;
  admin_name?: string;
  status_updated_by?: number;
  status_updated_by_name?: string;
}