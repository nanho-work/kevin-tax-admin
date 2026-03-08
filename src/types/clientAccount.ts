export interface ClientAccountOut {
  id: number;
  client_id: number;
  login_id: string;
  role_template_id: number;
  role_code: string;
  role_level?: number;
  rank_order?: number;
  role_name?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ClientAccountCreateRequest {
  client_id: number;
  login_id: string;
  password: string;
  role_code?: string;
  name: string;
  email?: string;
  phone?: string;
  is_active?: boolean;
}

export interface ClientAccountUpdateRequest {
  role_code?: string;
  name?: string;
  email?: string;
  phone?: string;
  is_active?: boolean;
}

export interface ClientAccountPasswordResetRequest {
  new_password: string;
}

export interface ClientAccountListFilters {
  client_id?: number;
  is_active?: boolean;
  q?: string;
}
