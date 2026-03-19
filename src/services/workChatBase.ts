import axios, { type AxiosInstance } from 'axios'
import { MAX_PAGE_SIZE, normalizePage, normalizePageSize } from '@/lib/pagination'
import { createMultipartUploadAdapter, uploadViaAdapter } from '@/services/upload/multipartUpload'
import type {
  WorkChatAttachment,
  WorkChatAttachmentUrlOut,
  WorkChatCreateRoomRequest,
  WorkChatCreateRoomResponse,
  WorkChatMemberType,
  WorkChatMessage,
  WorkChatMessageListResponse,
  WorkChatReadCursor,
  WorkChatMessageSearchResponse,
  WorkChatMessageType,
  WorkChatRoomPreferenceUpdateRequest,
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
  if (value === 'text' || value === 'system' || value === 'file' || value === 'image') return value
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
    avatar_url:
      raw.avatar_url != null
        ? String(raw.avatar_url)
        : raw.profile_image_url != null
          ? String(raw.profile_image_url)
          : raw.profileImageUrl != null
            ? String(raw.profileImageUrl)
            : raw.company_logo_url != null
              ? String(raw.company_logo_url)
              : raw.logo_url != null
                ? String(raw.logo_url)
                : null,
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
    is_active: raw.is_active == null ? true : Boolean(raw.is_active),
    company_id: raw.company_id == null ? null : toNumber(raw.company_id, 0) || null,
    name: raw.name == null ? null : String(raw.name),
    display_name: raw.display_name == null ? null : String(raw.display_name),
    members: membersRaw
      .map((member: RawRecord) => normalizeParticipant(member, 'admin'))
      .filter((row: WorkChatParticipant) => row.member_id > 0),
    is_hidden: Boolean(raw.is_hidden),
    is_muted: Boolean(raw.is_muted),
    muted_until: raw.muted_until == null ? null : String(raw.muted_until),
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
  const totalFromPayload =
    data?.total ??
    data?.total_count ??
    data?.count ??
    data?.pagination?.total ??
    data?.meta?.total
  const pageFromPayload =
    data?.page ??
    data?.current_page ??
    data?.pagination?.page ??
    data?.meta?.page
  const sizeFromPayload =
    data?.size ??
    data?.limit ??
    data?.page_size ??
    data?.pagination?.size ??
    data?.meta?.size
  return {
    items,
    total: toNumber(totalFromPayload, items.length),
    page: toNumber(pageFromPayload, 1),
    size: toNumber(sizeFromPayload, items.length || 20),
  }
}

function normalizeMessage(raw: RawRecord): WorkChatMessage {
  const rawAttachment = raw.attachment as RawRecord | undefined
  const attachment: WorkChatAttachment | null =
    rawAttachment && toNumber(rawAttachment.id ?? rawAttachment.attachment_id) > 0
      ? {
          id: toNumber(rawAttachment.id ?? rawAttachment.attachment_id),
          message_id: toNumber(rawAttachment.message_id),
          file_name: String(rawAttachment.file_name ?? ''),
          content_type:
            rawAttachment.content_type == null ? null : String(rawAttachment.content_type),
          file_size: toNumber(rawAttachment.file_size, 0),
          kind:
            rawAttachment.kind === 'image' || rawAttachment.kind === 'file'
              ? rawAttachment.kind
              : null,
          is_expired: Boolean(rawAttachment.is_expired),
          expires_at:
            rawAttachment.expires_at == null ? null : String(rawAttachment.expires_at),
        }
      : null
  return {
    id: toNumber(raw.id ?? raw.message_id),
    room_id: toNumber(raw.room_id ?? raw.roomId),
    sender_type: normalizeSenderType(raw.sender_type ?? raw.member_type),
    sender_id:
      raw.sender_id == null
        ? null
        : toNumber(raw.sender_id, 0),
    sender_name: raw.sender_name == null ? null : String(raw.sender_name),
    message_type: normalizeMessageType(raw.message_type ?? raw.type),
    body: raw.body == null ? null : String(raw.body),
    attachment,
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

function normalizeMessageSearchListResponse(data: any): WorkChatMessageSearchResponse {
  const rawItems = Array.isArray(data?.items) ? data.items : []
  return {
    total: toNumber(data?.total, rawItems.length),
    page: toNumber(data?.page, 1),
    size: toNumber(data?.size, rawItems.length || 50),
    items: rawItems.map((raw: RawRecord) => ({
      message_id: toNumber(raw.message_id ?? raw.id),
      room_id: toNumber(raw.room_id),
      sender_type: normalizeSenderType(raw.sender_type),
      sender_id: raw.sender_id == null ? null : toNumber(raw.sender_id, 0),
      sender_name: raw.sender_name == null ? null : String(raw.sender_name),
      message_type: normalizeMessageType(raw.message_type),
      snippet: String(raw.snippet ?? ''),
      created_at: String(raw.created_at ?? ''),
    })),
  }
}

function normalizeReadCursors(data: any): WorkChatReadCursor[] {
  const rawItems = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
  return rawItems
    .map((raw: RawRecord) => ({
      room_id: toNumber(raw.room_id ?? raw.roomId),
      member_type: normalizeMemberType(raw.member_type ?? raw.type),
      member_id: toNumber(raw.member_id ?? raw.memberId),
      last_read_message_id:
        raw.last_read_message_id == null
          ? null
          : toNumber(raw.last_read_message_id, 0) || null,
      read_at: raw.read_at == null ? null : String(raw.read_at),
    }))
    .filter((row: WorkChatReadCursor) => row.room_id > 0 && row.member_id > 0)
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
  const uploadAttachmentAdapter = createMultipartUploadAdapter<WorkChatMessage, { file: File; roomId: number }>({
    url: ({ roomId }) => `${base}/rooms/${roomId}/attachments`,
    responseMapper: (raw) => normalizeMessage(raw?.message ?? raw),
  })

  return {
    async listParticipants(): Promise<WorkChatParticipantsResponse> {
      const res = await httpClient.get(`${base}/participants`)
      return normalizeParticipantsResponse(res.data)
    },
    async listRooms(params?: {
      page?: number
      size?: number
      room_type?: WorkChatRoomType | ''
      include_hidden?: boolean
    }): Promise<WorkChatRoomListResponse> {
      const page = normalizePage(params?.page, 1)
      const size = normalizePageSize(params?.size, 20, MAX_PAGE_SIZE)
      const res = await httpClient.get(`${base}/rooms`, {
        params: {
          page,
          size,
          room_type: params?.room_type || undefined,
          include_hidden: params?.include_hidden ?? undefined,
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
    async searchMessages(
      roomId: number,
      params: { q: string; page?: number; size?: number }
    ): Promise<WorkChatMessageSearchResponse> {
      const page = normalizePage(params.page, 1)
      const size = normalizePageSize(params.size, 50, MAX_PAGE_SIZE)
      const res = await httpClient.get(`${base}/rooms/${roomId}/messages/search`, {
        params: {
          q: params.q,
          page,
          size,
        },
      })
      return normalizeMessageSearchListResponse(res.data)
    },
    async sendMessage(roomId: number, body: string): Promise<WorkChatMessage> {
      const res = await httpClient.post(`${base}/rooms/${roomId}/messages`, { body })
      return normalizeMessage(res.data)
    },
    async uploadAttachment(roomId: number, file: File): Promise<WorkChatMessage> {
      return uploadViaAdapter(httpClient, uploadAttachmentAdapter, { roomId, file })
    },
    async markRead(roomId: number, lastReadMessageId?: number | null): Promise<void> {
      await httpClient.post(`${base}/rooms/${roomId}/read`, {
        last_read_message_id: lastReadMessageId ?? undefined,
      })
    },
    async listReadCursors(roomId: number): Promise<WorkChatReadCursor[]> {
      const res = await httpClient.get(`${base}/rooms/${roomId}/read-cursors`)
      return normalizeReadCursors(res.data)
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
    async leaveRoom(roomId: number): Promise<{ message: string }> {
      const res = await httpClient.post<{ message: string }>(`${base}/rooms/${roomId}/leave`)
      return res.data
    },
    async updateRoomPreference(
      roomId: number,
      payload: WorkChatRoomPreferenceUpdateRequest
    ): Promise<WorkChatRoom> {
      const res = await httpClient.patch(`${base}/rooms/${roomId}/preference`, payload)
      return normalizeRoom(res.data)
    },
    async getAttachmentDownloadUrl(attachmentId: number): Promise<WorkChatAttachmentUrlOut> {
      const res = await httpClient.get<WorkChatAttachmentUrlOut>(`${base}/attachments/${attachmentId}/download-url`)
      return res.data
    },
    async getAttachmentPreviewUrl(attachmentId: number): Promise<WorkChatAttachmentUrlOut> {
      const res = await httpClient.get<WorkChatAttachmentUrlOut>(`${base}/attachments/${attachmentId}/preview-url`)
      return res.data
    },
    async saveAttachmentToCompany(
      attachmentId: number,
      payload: { company_id: number; title?: string }
    ): Promise<{ message: string; company_document_id?: number | null }> {
      const res = await httpClient.post<{ message: string; company_document_id?: number | null }>(
        `${base}/attachments/${attachmentId}/save-to-company`,
        payload
      )
      return res.data
    },
  }
}
