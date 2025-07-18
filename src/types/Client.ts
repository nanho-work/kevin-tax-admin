// src/types/client.ts

export type ClientOut = {
  id: number;
  company_name: string;
  business_number: string;
  admin_email: string;
  admin_phone: string;
  address1?: string | null;
  address2?: string | null;
  status: "active" | "inactive";
  created_at: string; // ISO 날짜 문자열
  updated_at: string;
};