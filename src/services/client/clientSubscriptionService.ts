import axios from 'axios'
import { clientHttp } from '@/services/http'

const CLIENT_DOCS_BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/docs`

export type ClientDocsStorageUsageResponse = {
  plan_code?: string
  plan_name?: string
  quota_bytes: number
  used_active_bytes: number
  used_trash_bytes: number
  used_total_bytes: number
  available_bytes: number
  usage_rate: number
  soft_warn_80: boolean
  hard_warn_95: boolean
}

type ApiErrorPayload = {
  detail?: string | { message?: string } | null
}

export function getClientSubscriptionErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return '요금제 정보를 불러오지 못했습니다.'
  const detail = (error.response?.data as ApiErrorPayload | undefined)?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (detail && typeof detail === 'object' && typeof detail.message === 'string' && detail.message.trim()) {
    return detail.message
  }
  const status = error.response?.status
  if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
  if (status === 403) return '요금제 정보를 조회할 권한이 없습니다.'
  if (status === 404) return '요금제 정보를 찾을 수 없습니다.'
  return '요금제 정보를 불러오지 못했습니다.'
}

export async function fetchClientDocsStorageUsage(): Promise<ClientDocsStorageUsageResponse> {
  const res = await clientHttp.get<ClientDocsStorageUsageResponse>(`${CLIENT_DOCS_BASE}/storage/usage`)
  return res.data
}

