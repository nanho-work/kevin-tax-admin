

// 상담 요청 상태 타입
export type ConsultRequestStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

// 상담 요청 기본 타입 (어드민용)
export interface AdminConsultRequestBase {
  id: number;
  title: string;
  content: string;
  category?: string;
  preferred_date?: string;
  status: ConsultRequestStatus;
  name?: string; // 비회원 이름
  phone?: string; // 비회원 연락처
  email?: string; // 비회원 이메일
  customer_id?: number;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  company_id?: number;
  company_name?: string;
  attachments: string[];
  created_at: string;
  updated_at: string;
}

// 상담 요청 상태 변경 요청
export interface ConsultRequestStatusUpdate {
  status: ConsultRequestStatus;
}