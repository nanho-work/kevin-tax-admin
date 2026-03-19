import { clientHttp } from '@/services/http'
import { createMultipartUploadAdapter, uploadViaAdapter } from '@/services/upload/multipartUpload'
import type {
  SupervisorTemplateCodeCreateRequest,
  SupervisorTemplateCodeListResponse,
  SupervisorTemplateCodeOut,
  SupervisorTemplateCodeUpdateRequest,
  SupervisorTemplateDownloadResponse,
  SupervisorTemplateUploadResponse,
} from '@/types/clientTemplate'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/templates`
const uploadClientTemplateFileByCodeAdapter = createMultipartUploadAdapter<
  SupervisorTemplateUploadResponse,
  { file: File; code: string }
>({
  url: ({ code }) => `${BASE}/${encodeURIComponent(code)}/upload`,
})

export async function listClientTemplates(params?: { is_active?: boolean }): Promise<SupervisorTemplateCodeListResponse> {
  const res = await clientHttp.get<SupervisorTemplateCodeListResponse>(`${BASE}/`, { params })
  return res.data
}

export async function createClientTemplateCode(
  payload: SupervisorTemplateCodeCreateRequest
): Promise<SupervisorTemplateCodeOut> {
  const res = await clientHttp.post<SupervisorTemplateCodeOut>(`${BASE}/`, payload)
  return res.data
}

export async function updateClientTemplateCode(
  templateId: number,
  payload: SupervisorTemplateCodeUpdateRequest
): Promise<SupervisorTemplateCodeOut> {
  const res = await clientHttp.patch<SupervisorTemplateCodeOut>(`${BASE}/${templateId}`, payload)
  return res.data
}

export async function uploadClientTemplateFileByCode(
  code: string,
  file: File
): Promise<SupervisorTemplateUploadResponse> {
  return uploadViaAdapter(clientHttp, uploadClientTemplateFileByCodeAdapter, { code, file })
}

export async function getClientTemplateDownloadUrlByCode(
  code: string
): Promise<SupervisorTemplateDownloadResponse> {
  const res = await clientHttp.get<SupervisorTemplateDownloadResponse>(`${BASE}/${encodeURIComponent(code)}/download-url`)
  return res.data
}
