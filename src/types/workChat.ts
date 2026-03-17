export type WorkChatRoomType = 'direct' | 'group' | 'company_bridge'
export type WorkChatMemberType = 'admin' | 'client_account' | 'company_account'
export type WorkChatSenderType = WorkChatMemberType | 'system'
export type WorkChatMessageType = 'text' | 'system'

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
  company_id?: number | null
  name: string | null
  display_name?: string | null
  members?: WorkChatParticipant[]
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
  message_type: WorkChatMessageType
  body: string | null
  is_deleted: boolean
  created_at: string
}

export type WorkChatMessageListResponse = {
  items: WorkChatMessage[]
  next_before_message_id: number | null
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
