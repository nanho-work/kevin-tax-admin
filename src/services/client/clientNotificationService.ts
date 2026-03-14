import axios from 'axios'
import { clientHttp } from '@/services/http'
import type {
  PortalNotificationItem,
  PortalNotificationListResponse,
  PortalNotificationUnreadCountResponse,
} from '@/types/portalNotification'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/notifications/`

function normalizeNotificationItem(raw: any): PortalNotificationItem {
  const event = raw?.event ?? {}
  const receiptId = Number(raw?.receipt_id ?? raw?.id ?? 0)
  return {
    receipt_id: receiptId,
    event_id: raw?.event_id ?? event?.id ?? null,
    domain: raw?.domain ?? event?.domain,
    action: raw?.action ?? event?.action,
    priority: raw?.priority ?? event?.priority,
    title: String(raw?.title ?? event?.title ?? ''),
    body: raw?.body ?? event?.body ?? null,
    deeplink_url: raw?.deeplink_url ?? event?.deeplink_url ?? null,
    source_type: raw?.source_type ?? event?.source_type ?? null,
    source_id: raw?.source_id ?? event?.source_id ?? null,
    source_snapshot_json: raw?.source_snapshot_json ?? event?.source_snapshot_json ?? null,
    status: String(raw?.status ?? 'unread'),
    read_at: raw?.read_at ?? null,
    created_at: String(raw?.created_at ?? raw?.event_created_at ?? event?.created_at ?? ''),
  }
}

function normalizeNotificationListResponse(data: any): PortalNotificationListResponse {
  const rawItems = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
  const items = rawItems
    .map((rawItem: any) => normalizeNotificationItem(rawItem))
    .filter((item: PortalNotificationItem) => item.receipt_id > 0 && item.title)
  const resolvedLimit = data?.limit ?? (items.length > 0 ? items.length : 20)
  return {
    items,
    total: Number(data?.total ?? items.length),
    page: Number(data?.page ?? 1),
    limit: Number(resolvedLimit),
  }
}

export function getClientNotificationErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const detail = (error.response?.data as any)?.detail
    const detailText = typeof detail === 'string' ? detail : ''

    if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
    if (status === 403) return '알림을 조회할 권한이 없습니다.'
    if (status === 404) return '알림 정보를 찾을 수 없습니다.'
    if (status === 422) return detailText || '요청 값을 확인해 주세요.'
    if (typeof status === 'number' && status >= 500) return '알림 처리 중 오류가 발생했습니다.'
    return detailText || '알림 처리 중 오류가 발생했습니다.'
  }
  return '알림 처리 중 오류가 발생했습니다.'
}

export async function listClientNotifications(params?: {
  page?: number
  limit?: number
  status?: string
}): Promise<PortalNotificationListResponse> {
  const page = params?.page ?? 1
  const limit = params?.limit ?? 20
  const offset = Math.max(0, (page - 1) * limit)
  const status = (params?.status || '').toLowerCase()
  const unreadOnly = status === 'unread' ? true : status === 'read' ? false : undefined
  const res = await clientHttp.get(BASE, {
    params: {
      limit,
      offset,
      unread_only: unreadOnly,
    },
  })
  return normalizeNotificationListResponse(res.data)
}

export async function markClientNotificationRead(receiptId: number): Promise<void> {
  await clientHttp.patch(`${BASE}${receiptId}/read`, {})
}

export async function markAllClientNotificationsRead(): Promise<number> {
  const res = await clientHttp.patch<{ updated_count?: number }>(`${BASE}read-all`, {})
  return Number(res.data?.updated_count ?? 0)
}

export async function fetchClientNotificationUnreadCount(): Promise<number> {
  const res = await clientHttp.get<PortalNotificationUnreadCountResponse | { count?: number }>(`${BASE}unread-count`)
  const unreadCount = Number((res.data as any)?.unread_count ?? (res.data as any)?.count ?? 0)
  return Number.isFinite(unreadCount) && unreadCount >= 0 ? unreadCount : 0
}
