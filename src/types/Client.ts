// src/types/client.ts

export type ClientOut = {
  id: number;
  business_type: 'individual' | 'corporate';
  company_name: string;
  business_number: string;
  admin_email: string;
  admin_phone: string;
  postal_code?: string | null;
  address1?: string | null;
  address2?: string | null;
  status: "active" | "inactive";
  created_at: string; // ISO 날짜 문자열
  updated_at: string;
};

export type ClientStatus = 'active' | 'inactive'

export type ClientListFilters = {
  q?: string
  status?: ClientStatus
}

export type ClientCreateRequest = {
  business_type: 'individual' | 'corporate'
  company_name: string
  business_number: string
  admin_email: string
  admin_phone: string
  postal_code?: string
  address1?: string
  address2?: string
  status?: ClientStatus
}
