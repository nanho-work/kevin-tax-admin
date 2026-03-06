export interface SupervisorTemplateCodeOut {
  id: number
  code: string
  name: string
  description?: string | null
  file_key?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SupervisorTemplateCodeListResponse {
  total: number
  items: SupervisorTemplateCodeOut[]
}

export interface SupervisorTemplateCodeCreateRequest {
  code: string
  name: string
  description?: string | null
  file_key?: string | null
  is_active?: boolean
}

export interface SupervisorTemplateCodeUpdateRequest {
  name?: string | null
  description?: string | null
  file_key?: string | null
  is_active?: boolean | null
}

export interface SupervisorTemplateUploadResponse {
  message: string
  code: string
  file_key: string
}

export interface SupervisorTemplateDownloadResponse {
  code: string
  name: string
  file_name: string
  download_url: string
}

