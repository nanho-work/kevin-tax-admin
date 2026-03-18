export type WorkChatRoomType = 'direct' | 'group' | 'company_bridge'
export type WorkChatMemberType = 'admin' | 'client_account' | 'company_account'
export type WorkChatSenderType = WorkChatMemberType | 'system'
export type WorkChatMessageType = 'text' | 'system' | 'file' | 'image'
export type WorkChatAttachmentKind = 'image' | 'file'

export type WorkChatParticipant = {
  member_type: WorkChatMemberType
  member_id: number
  company_id?: number | null
  name: string
  avatar_url?: string | null
  subtitle?: string
}

export type WorkChatParticipantsResponse = {
  admins: WorkChatParticipant[]
  client_accounts: WorkChatParticipant[]
  company_accounts: WorkChatParticipant[]
}

export type WorkChatRoom = {
  id: number
  room_type: WorkChatRoomType
  is_active?: boolean
  company_id?: number | null
  name: string | null
  display_name?: string | null
  members?: WorkChatParticipant[]
  is_hidden?: boolean
  is_muted?: boolean
  muted_until?: string | null
  unread_count: number
  unread_count_display: string
  last_message_preview: string | null
  last_message_id?: number | null
  last_message_at: string | null
}

export type WorkChatRoomListResponse = {
  items: WorkChatRoom[]
  total: number
  page: number
  size: number
}

export type WorkChatMessage = {
  id: number
  room_id: number
  sender_type: WorkChatSenderType
  sender_id: number | null
  sender_name?: string | null
  message_type: WorkChatMessageType
  body: string | null
  attachment?: WorkChatAttachment | null
  is_deleted: boolean
  created_at: string
}

export type WorkChatAttachment = {
  id: number
  message_id: number
  file_name: string
  content_type?: string | null
  file_size: number
  kind?: WorkChatAttachmentKind | null
  is_expired: boolean
  expires_at?: string | null
}

export type WorkChatAttachmentUrlOut = {
  attachment_id: number
  message_id: number
  file_name: string
  content_type?: string | null
  file_size: number
  kind?: WorkChatAttachmentKind | null
  is_expired: boolean
  expires_at?: string | null
  url?: string | null
  expires_in?: number | null
}

export type WorkChatMessageListResponse = {
  items: WorkChatMessage[]
  next_before_message_id: number | null
}

export type WorkChatReadCursor = {
  room_id: number
  member_type: WorkChatMemberType
  member_id: number
  last_read_message_id: number | null
  read_at: string | null
}

export type WorkChatMessageSearchItem = {
  message_id: number
  room_id: number
  sender_type: WorkChatSenderType
  sender_id: number | null
  sender_name?: string | null
  message_type: WorkChatMessageType
  snippet: string
  created_at: string
}

export type WorkChatMessageSearchResponse = {
  total: number
  page: number
  size: number
  items: WorkChatMessageSearchItem[]
}

export type WorkChatRoomCreateMember = {
  member_type: WorkChatMemberType
  member_id: number
}

export type WorkChatCreateRoomRequest = {
  room_type: WorkChatRoomType
  name?: string
  members: WorkChatRoomCreateMember[]
}

export type WorkChatCreateRoomResponse = {
  room: WorkChatRoom
  created: boolean
}

export type WorkChatRoomPreferenceUpdateRequest = {
  is_hidden?: boolean
  is_muted?: boolean
  muted_until?: string | null
}
