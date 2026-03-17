import axios, { type AxiosInstance } from 'axios'
import type {
  WorkChatCreateRoomRequest,
  WorkChatCreateRoomResponse,
  WorkChatMemberType,
  WorkChatMessage,
  WorkChatMessageListResponse,
  WorkChatMessageType,
  WorkChatParticipantsResponse,
  WorkChatParticipant,
  WorkChatRoom,
  WorkChatRoomListResponse,
  WorkChatRoomType,
  WorkChatSenderType,
} from '@/types/workChat'

type RawRecord = Record<string, any>

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeMemberType(value: unknown): WorkChatMemberType {
  if (value === 'admin' || value === 'client_account' || value === 'company_account') return value
  return 'admin'
}

function normalizeRoomType(value: unknown): WorkChatRoomType {
  if (value === 'direct' || value === 'group' || value === 'company_bridge') return value
  return 'direct'
}

function normalizeSenderType(value: unknown): WorkChatSenderType {
  if (
    value === 'admin' ||
    value === 'client_account' ||
    value === 'company_account' ||
    value === 'system'
  ) {
    return value
  }
  return 'system'
}

function normalizeMessageType(value: unknown): WorkChatMessageType {
  if (value === 'text' || value === 'system') return value
  return 'text'
}

function pickName(raw: RawRecord): string {
  return String(
    raw.name ??
      raw.display_name ??
      raw.member_name ??
      raw.company_name ??
      raw.email ??
      `사용자#${toNumber(raw.id ?? raw.member_id)}`
  )
}

function pickSubtitle(raw: RawRecord): string | undefined {
  const team = raw.team_name ? String(raw.team_name) : ''
  const role = raw.role_name ? String(raw.role_name) : ''
  const email = raw.email ? String(raw.email) : ''
  const parts = [team || '', role || '', email || ''].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

function normalizeParticipant(raw: RawRecord, fallbackType: WorkChatMemberType): WorkChatParticipant {
  const memberId = toNumber(
    raw.member_id ??
      raw.id ??
      raw.admin_id ??
      raw.client_account_id ??
      raw.company_account_id ??
      raw.partner_account_id ??
      raw.account_id ??
      raw.user_id
  )
  return {
    member_type: normalizeMemberType(raw.member_type ?? raw.type ?? fallbackType),
    member_id: memberId,
    company_id: raw.company_id == null ? null : toNumber(raw.company_id, 0) || null,
    name: pickName(raw),
    avatar_url: raw.profile_image_url == null ? null : String(raw.profile_image_url),
    subtitle: pickSubtitle(raw),
  }
}

function normalizeParticipantsResponse(data: any): WorkChatParticipantsResponse {
  const admins = Array.isArray(data?.admins) ? data.admins : []
  const clientAccounts = Array.isArray(data?.client_accounts) ? data.client_accounts : []
  const companyAccounts = Array.isArray(data?.company_accounts) ? data.company_accounts : []
  return {
    admins: admins.map((raw: RawRecord) => normalizeParticipant(raw, 'admin')),
    client_accounts: clientAccounts.map((raw: RawRecord) => normalizeParticipant(raw, 'client_account')),
    company_accounts: companyAccounts.map((raw: RawRecord) => normalizeParticipant(raw, 'company_account')),
  }
}

function normalizeRoom(raw: RawRecord): WorkChatRoom {
  const unreadCount = toNumber(raw.unread_count ?? raw.unreadCount, 0)
  const membersRaw = Array.isArray(raw.members) ? raw.members : []
  return {
    id: toNumber(raw.id ?? raw.room_id),
    room_type: normalizeRoomType(raw.room_type ?? raw.type),
    company_id: raw.company_id == null ? null : toNumber(raw.company_id, 0) || null,
    name: raw.name == null ? null : String(raw.name),
    display_name: raw.display_name == null ? null : String(raw.display_name),
    members: membersRaw
      .map((member: RawRecord) => normalizeParticipant(member, 'admin'))
      .filter((row: WorkChatParticipant) => row.member_id > 0),
    unread_count: unreadCount,
    unread_count_display:
      typeof raw.unread_count_display === 'string'
        ? raw.unread_count_display
        : unreadCount > 300
          ? '300+'
          : String(unreadCount),
    last_message_preview:
      raw.last_message_preview == null ? null : String(raw.last_message_preview),
    last_message_id:
      raw.last_message_id == null ? null : toNumber(raw.last_message_id, 0) || null,
    last_message_at: raw.last_message_at == null ? null : String(raw.last_message_at),
  }
}

function normalizeRoomListResponse(data: any): WorkChatRoomListResponse {
  const rawItems = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
  const items = rawItems.map((raw: RawRecord) => normalizeRoom(raw)).filter((row: WorkChatRoom) => row.id > 0)
  return {
    items,
    total: toNumber(data?.total, items.length),
    page: toNumber(data?.page, 1),
    size: toNumber(data?.size, items.length || 20),
  }
}

function normalizeMessage(raw: RawRecord): WorkChatMessage {
  return {
    id: toNumber(raw.id ?? raw.message_id),
    room_id: toNumber(raw.room_id ?? raw.roomId),
    sender_type: normalizeSenderType(raw.sender_type ?? raw.member_type),
    sender_id:
      raw.sender_id == null
        ? null
        : toNumber(raw.sender_id, 0),
    message_type: normalizeMessageType(raw.message_type ?? raw.type),
    body: raw.body == null ? null : String(raw.body),
    is_deleted: Boolean(raw.is_deleted),
    created_at: String(raw.created_at ?? raw.createdAt ?? ''),
  }
}

function normalizeMessageListResponse(data: any): WorkChatMessageListResponse {
  const rawItems = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
  const items = rawItems.map((raw: RawRecord) => normalizeMessage(raw)).filter((row: WorkChatMessage) => row.id > 0)
  return {
    items,
    next_before_message_id:
      data?.next_before_message_id == null
        ? null
        : toNumber(data.next_before_message_id, 0) || null,
  }
}

function normalizeCreateRoomResponse(data: any): WorkChatCreateRoomResponse {
  const roomCandidate = data?.room ?? data
  const room = normalizeRoom(roomCandidate || {})
  return {
    room,
    created: Boolean(data?.created ?? data?.is_created ?? false),
  }
}

export function getWorkChatErrorMessage(error: unknown, defaultMessage = '채팅 처리 중 오류가 발생했습니다.'): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const detail = (error.response?.data as any)?.detail
    const detailText = typeof detail === 'string' ? detail : ''
    if (status === 400) return detailText || '요청 값을 확인해 주세요.'
    if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
    if (status === 403) return detailText || '채팅방 접근 권한이 없습니다.'
    if (status === 404) return detailText || '채팅 대상을 찾을 수 없습니다.'
    if (status === 409) return detailText || '현재 상태에서 처리할 수 없습니다.'
    if (status === 422) return detailText || '입력 값을 확인해 주세요.'
    if (typeof status === 'number' && status >= 500) return '채팅 서버 처리 중 오류가 발생했습니다.'
    return detailText || defaultMessage
  }
  return defaultMessage
}

export function createWorkChatApi(httpClient: AxiosInstance, prefix: '/admin' | '/client' | '/company') {
  const base = `${process.env.NEXT_PUBLIC_API_BASE_URL}${prefix}/chats`

  return {
    async listParticipants(): Promise<WorkChatParticipantsResponse> {
      const res = await httpClient.get(`${base}/participants`)
      return normalizeParticipantsResponse(res.data)
    },
    async listRooms(params?: {
      page?: number
      size?: number
      room_type?: WorkChatRoomType | ''
    }): Promise<WorkChatRoomListResponse> {
      const res = await httpClient.get(`${base}/rooms`, {
        params: {
          page: params?.page ?? 1,
          size: params?.size ?? 20,
          room_type: params?.room_type || undefined,
        },
      })
      return normalizeRoomListResponse(res.data)
    },
    async createRoom(payload: WorkChatCreateRoomRequest): Promise<WorkChatCreateRoomResponse> {
      const res = await httpClient.post(`${base}/rooms`, payload)
      return normalizeCreateRoomResponse(res.data)
    },
    async listMessages(
      roomId: number,
      params?: { size?: number; before_message_id?: number | null }
    ): Promise<WorkChatMessageListResponse> {
      const res = await httpClient.get(`${base}/rooms/${roomId}/messages`, {
        params: {
          size: params?.size ?? 50,
          before_message_id: params?.before_message_id ?? undefined,
        },
      })
      return normalizeMessageListResponse(res.data)
    },
    async sendMessage(roomId: number, body: string): Promise<WorkChatMessage> {
      const res = await httpClient.post(`${base}/rooms/${roomId}/messages`, { body })
      return normalizeMessage(res.data)
    },
    async markRead(roomId: number, lastReadMessageId?: number | null): Promise<void> {
      await httpClient.post(`${base}/rooms/${roomId}/read`, {
        last_read_message_id: lastReadMessageId ?? undefined,
      })
    },
    async listRoomMembers(roomId: number): Promise<WorkChatParticipant[]> {
      try {
        const res = await httpClient.get(`${base}/rooms/${roomId}/members`)
        const items = Array.isArray(res.data?.items) ? res.data.items : Array.isArray(res.data) ? res.data : []
        return items
          .map((raw: RawRecord) => normalizeParticipant(raw, 'admin'))
          .filter((row: WorkChatParticipant) => row.member_id > 0)
      } catch (error) {
        if (!axios.isAxiosError(error)) {
          throw error
        }
        const fallback = await httpClient.get(`${base}/rooms/${roomId}`)
        const items = Array.isArray(fallback.data?.members)
          ? fallback.data.members
          : Array.isArray(fallback.data?.items)
            ? fallback.data.items
            : []
        return items
          .map((raw: RawRecord) => normalizeParticipant(raw, 'admin'))
          .filter((row: WorkChatParticipant) => row.member_id > 0)
      }
    },
    async deleteMessage(messageId: number): Promise<void> {
      await httpClient.delete(`${base}/messages/${messageId}`)
    },
    async leaveRoom(roomId: number): Promise<void> {
      await httpClient.post(`${base}/rooms/${roomId}/leave`)
    },
  }
}
