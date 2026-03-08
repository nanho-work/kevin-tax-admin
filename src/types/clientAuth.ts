export interface ClientLoginRequest {
  login_id: string
  password: string
}

export interface ClientSession {
  account_id: number
  client_id: number
  login_id: string
  name: string
  is_active: boolean
  role_template_id: number
  role_code: string
  role_level?: number
  rank_order?: number
  role_name?: string | null
}
