export type DashboardNote = {
  id: number
  client_id: number
  user_type: 'client_account' | 'admin'
  user_id: number
  content: string
  text_color: string
  bg_color: string
  font_size: number
  created_at: string
  updated_at: string
}

export type DashboardNotePatchRequest = {
  content: string
  text_color: string
  bg_color: string
  font_size: number
}

