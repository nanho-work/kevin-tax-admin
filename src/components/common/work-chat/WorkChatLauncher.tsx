'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import axios from 'axios'
import {
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Building2,
  File,
  GripHorizontal,
  MessageCircle,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  Save,
  Search,
  UsersRound,
  X,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import UiButton from '@/components/common/UiButton'
import ChatComposer from '@/components/common/work-chat/ChatComposer'
import { fetchCompanyTaxList } from '@/services/admin/company'
import { fetchClientCompanyTaxList } from '@/services/client/company'
import { adminWorkChatApi, getAdminWorkChatErrorMessage } from '@/services/admin/workChatService'
import { clientWorkChatApi, getClientWorkChatErrorMessage } from '@/services/client/workChatService'
import { getAdminAccessToken, getClientAccessToken } from '@/services/http'
import type { CompanyTaxDetail } from '@/types/admin_campany'
import type {
  WorkChatCreateRoomRequest,
  WorkChatMessage,
  WorkChatMessageSearchItem,
  WorkChatParticipant,
  WorkChatParticipantsResponse,
  WorkChatReadCursor,
  WorkChatRoom,
} from '@/types/workChat'
import { PROFILE_IMAGE_UPDATED_EVENT } from '@/utils/profileImageEvents'

type PortalType = 'admin' | 'client'
type LauncherTab = 'employees' | 'companies' | 'rooms'

type WorkChatLauncherProps = {
  portalType: PortalType
  actor: {
    type: 'admin' | 'client_account'
    id: number
  }
}

const LAUNCHER_DEFAULT_WIDTH = 360
const LAUNCHER_DEFAULT_HEIGHT = 640
const CHAT_WINDOW_BASE_WIDTH = 460
const CHAT_WINDOW_BASE_HEIGHT = 620
const CHAT_WINDOW_DEFAULT_WIDTH = Math.round(CHAT_WINDOW_BASE_WIDTH * (2 / 3))
const CHAT_WINDOW_DEFAULT_HEIGHT = CHAT_WINDOW_BASE_HEIGHT
const CHAT_WINDOW_MIN_WIDTH = CHAT_WINDOW_DEFAULT_WIDTH
const CHAT_WINDOW_MIN_HEIGHT = Math.round(CHAT_WINDOW_BASE_HEIGHT * (2 / 3))
const CHAT_WINDOW_MAX_HEIGHT = Math.round(CHAT_WINDOW_BASE_HEIGHT * 1.5)
const TYPING_AUTO_CLEAR_MS = 1600
const WS_RECONNECT_MAX_MS = 15000

type WsPresenceState = {
  online: boolean
  inRoom: boolean
  roomId: number | null
}

type WsTypingState = {
  roomId: number
  name: string
}

type RoomReadCursorState = Record<string, number>

function formatKoreanDateTime(value?: string | null): string {
  if (!value) return '-'
  const date = parseServerDate(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatRoomListDateTime(value?: string | null): string {
  if (!value) return ''
  const date = parseServerDate(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatTimeOnly(value?: string | null): string {
  if (!value) return ''
  const date = parseServerDate(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatKoreanDayLabel(value?: string | null): string {
  if (!value) return ''
  const date = parseServerDate(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(date)
}

function dateKey(value?: string | null): string {
  if (!value) return ''
  const date = parseServerDate(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

function parseServerDate(value: string): Date {
  const raw = String(value).trim()
  if (!raw) return new Date(NaN)

  const normalized = raw.replace(' ', 'T')
  const hasTimezone = /([zZ]|[+\-]\d{2}:\d{2})$/.test(normalized)
  return new Date(hasTimezone ? normalized : `${normalized}Z`)
}

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size < 1024) return `${Math.max(0, Math.floor(size || 0))}B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)}MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)}GB`
}

function canPreviewAttachment(contentType?: string | null, fileName?: string | null): boolean {
  const lowerType = String(contentType || '').toLowerCase()
  const lowerName = String(fileName || '').toLowerCase()
  if (lowerType.startsWith('image/')) return true
  if (lowerType === 'application/pdf' || lowerName.endsWith('.pdf')) return true
  if (lowerType.startsWith('text/')) return true
  if (lowerName.endsWith('.txt') || lowerName.endsWith('.md')) return true
  return false
}

function isImageAttachment(contentType?: string | null, fileName?: string | null, kind?: string | null): boolean {
  if (kind === 'image') return true
  const lowerType = String(contentType || '').toLowerCase()
  const lowerName = String(fileName || '').toLowerCase()
  if (lowerType.startsWith('image/')) return true
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'].some((ext) =>
    lowerName.endsWith(ext)
  )
}

function buildRoomTitle(room: WorkChatRoom, roomMembers: WorkChatParticipant[]): string {
  if (room.display_name && room.display_name.trim()) return room.display_name
  if (room.name && room.name.trim()) return room.name
  if (roomMembers.length === 0) return `채팅방 #${room.id}`
  return roomMembers.map((member) => member.name).join(', ')
}

function getRoomDisplayName(room: WorkChatRoom): string {
  if (room.display_name && room.display_name.trim()) return room.display_name
  if (room.name && room.name.trim()) return room.name
  if (Array.isArray(room.members) && room.members.length > 0) {
    const names = room.members
      .map((member) => member.name?.trim())
      .filter((name): name is string => Boolean(name))
    if (names.length > 0) return names.join(', ')
  }
  return `대화방 #${room.id}`
}

function getParticipantInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed.slice(0, 1)
}

function normalizeNameKey(name: string): string {
  return String(name || '').trim().toLowerCase()
}

function includeByKeyword(row: WorkChatParticipant, keyword: string): boolean {
  const normalized = keyword.trim().toLowerCase()
  if (!normalized) return true
  return `${row.name} ${row.subtitle || ''}`.toLowerCase().includes(normalized)
}

function mergeParticipantsWithPresence(
  participants: WorkChatParticipantsResponse,
  presence: WorkChatParticipantsResponse
): WorkChatParticipantsResponse {
  const buildPresenceMap = (rows: WorkChatParticipant[]) => {
    const map = new Map<string, WorkChatParticipant>()
    rows.forEach((row) => {
      map.set(`${row.member_type}:${row.member_id}`, row)
    })
    return map
  }

  const adminPresence = buildPresenceMap(presence.admins || [])
  const clientPresence = buildPresenceMap(presence.client_accounts || [])
  const companyPresence = buildPresenceMap(presence.company_accounts || [])

  const mergeRows = (rows: WorkChatParticipant[], presenceMap: Map<string, WorkChatParticipant>) =>
    rows.map((row) => {
      const key = `${row.member_type}:${row.member_id}`
      const status = presenceMap.get(key)
      if (!status) return row
      return {
        ...row,
        online: status.online,
        in_room: status.in_room,
        room_id: status.room_id ?? status.current_room_id ?? null,
        current_room_id: status.current_room_id ?? status.room_id ?? null,
        last_seen_at: status.last_seen_at ?? null,
      }
    })

  return {
    admins: mergeRows(participants.admins || [], adminPresence),
    client_accounts: mergeRows(participants.client_accounts || [], clientPresence),
    company_accounts: mergeRows(participants.company_accounts || [], companyPresence),
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderHighlightedText(
  text: string,
  keyword: string,
  markClassName: string
) {
  const normalized = keyword.trim()
  if (!normalized) return text
  const regex = new RegExp(`(${escapeRegExp(normalized)})`, 'ig')
  const parts = text.split(regex)
  if (parts.length <= 1) return text
  return parts.map((part, idx) =>
    part.toLowerCase() === normalized.toLowerCase() ? (
      <mark key={`${part}-${idx}`} className={markClassName}>
        {part}
      </mark>
    ) : (
      <span key={`${part}-${idx}`}>{part}</span>
    )
  )
}

function ChatBubble({
  align,
  tone,
  className,
  children,
  onContextMenu,
}: {
  align: 'left' | 'right'
  tone: 'mine' | 'other'
  className?: string
  children: React.ReactNode
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void
}) {
  const isRight = align === 'right'
  const isMine = tone === 'mine'

  return (
    <div
      onContextMenu={onContextMenu}
      className={`relative rounded-lg border ${
        isMine ? 'border-sky-200 bg-sky-100 text-sky-900' : 'border-amber-200 bg-amber-50 text-zinc-800'
      } ${className || ''}`}
    >
      {children}
      <span
        className={`pointer-events-none absolute top-3 ${isRight ? '-right-[7px]' : '-left-[7px]'}`}
        aria-hidden="true"
      >
        <svg
          width="8"
          height="11"
          viewBox="0 0 8 11"
          className={`${isRight ? 'scale-x-[-1]' : ''} scale-y-[-1]`}
        >
          <path
            d="M8 0.7 C4.3 2 2.2 4 0 8.9 L8 7.1 Z"
            fill={isMine ? '#e0f2fe' : '#fffbeb'}
            stroke={isMine ? '#bae6fd' : '#fde68a'}
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  )
}

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function toActorKey(memberType: string, memberId: number) {
  return `${memberType}:${memberId}`
}

function buildActorKeySet(members: Array<{ member_type: string; member_id: number }>) {
  return new Set(
    members
      .map((member) => toActorKey(member.member_type, Number(member.member_id || 0)))
      .filter((key) => !key.endsWith(':0'))
  )
}

function buildWsUrl(portalType: PortalType, token: string) {
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || '').trim()
  if (!apiBase || !token) return ''
  const wsBase = apiBase.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://')
  return `${wsBase}/ws/${portalType}/chats?token=${encodeURIComponent(token)}`
}

function normalizeIncomingMessage(raw: any): WorkChatMessage | null {
  const id = toNumber(raw?.id ?? raw?.message_id)
  const roomId = toNumber(raw?.room_id ?? raw?.roomId)
  if (id <= 0 || roomId <= 0) return null
  const senderType =
    raw?.sender_type === 'admin' ||
    raw?.sender_type === 'client_account' ||
    raw?.sender_type === 'company_account' ||
    raw?.sender_type === 'system'
      ? raw.sender_type
      : 'system'
  const messageType =
    raw?.message_type === 'system' || raw?.message_type === 'file' || raw?.message_type === 'image'
      ? raw.message_type
      : 'text'
  const attachment = raw?.attachment
    ? {
        id: toNumber(raw.attachment.id ?? raw.attachment.attachment_id),
        message_id: toNumber(raw.attachment.message_id),
        file_name: String(raw.attachment.file_name ?? ''),
        content_type:
          raw.attachment.content_type == null ? null : String(raw.attachment.content_type),
        file_size: toNumber(raw.attachment.file_size, 0),
        kind:
          raw.attachment.kind === 'image' || raw.attachment.kind === 'file'
            ? raw.attachment.kind
            : null,
        is_expired: Boolean(raw.attachment.is_expired),
        expires_at:
          raw.attachment.expires_at == null ? null : String(raw.attachment.expires_at),
      }
    : null
  return {
    id,
    room_id: roomId,
    sender_type: senderType,
    sender_id: raw?.sender_id == null ? null : toNumber(raw.sender_id, 0),
    sender_name: raw?.sender_name == null ? null : String(raw.sender_name),
    sender_profile_image_url:
      raw?.sender_profile_image_url == null
        ? raw?.profile_image_url == null
          ? null
          : String(raw.profile_image_url)
        : String(raw.sender_profile_image_url),
    message_type: messageType,
    body: raw?.body == null ? null : String(raw.body),
    attachment,
    is_deleted: Boolean(raw?.is_deleted),
    created_at: String(raw?.created_at ?? ''),
  }
}

function isAtBottom(element: HTMLDivElement | null): boolean {
  if (!element) return false
  const threshold = 36
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold
}

function toUnreadCountDisplay(count: number): string {
  if (count <= 0) return '0'
  return count > 300 ? '300+' : String(count)
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function isRoomAccessError(error: unknown): boolean {
  return axios.isAxiosError(error) && (error.response?.status === 403 || error.response?.status === 404)
}

function sortRoomsByRecentMessage(rows: WorkChatRoom[]): WorkChatRoom[] {
  return [...rows].sort((a, b) => {
    const aTs = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
    const bTs = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
    if (aTs !== bTs) return bTs - aTs
    return b.id - a.id
  })
}

function mergeAndSortMessages(base: WorkChatMessage[], incoming: WorkChatMessage[]): WorkChatMessage[] {
  const map = new Map<number, WorkChatMessage>()
  base.forEach((row) => map.set(row.id, row))
  incoming.forEach((row) => map.set(row.id, row))
  return Array.from(map.values()).sort((a, b) => a.id - b.id)
}

function normalizeWsRoomPatch(raw: any): (Partial<WorkChatRoom> & { id: number }) | null {
  const target = raw?.room ?? raw
  const id = toNumber(target?.id ?? target?.room_id ?? target?.roomId)
  if (id <= 0) return null
  const hasOwn = (key: string) =>
    target != null && Object.prototype.hasOwnProperty.call(target, key)
  return {
    id,
    room_type: hasOwn('room_type') ? target.room_type : hasOwn('roomType') ? target.roomType : undefined,
    is_active: hasOwn('is_active') ? Boolean(target.is_active) : undefined,
    name: hasOwn('name') ? (target.name == null ? null : String(target.name)) : undefined,
    display_name: hasOwn('display_name') ? (target.display_name == null ? null : String(target.display_name)) : undefined,
    is_hidden: hasOwn('is_hidden') ? Boolean(target.is_hidden) : undefined,
    is_muted: hasOwn('is_muted') ? Boolean(target.is_muted) : undefined,
    muted_until: hasOwn('muted_until')
      ? target.muted_until == null
        ? null
        : String(target.muted_until)
      : undefined,
    unread_count: hasOwn('unread_count') ? toNumber(target.unread_count, 0) : undefined,
    unread_count_display:
      hasOwn('unread_count_display') ? String(target.unread_count_display ?? '') : undefined,
    last_message_preview:
      hasOwn('last_message_preview')
        ? target.last_message_preview == null
          ? null
          : String(target.last_message_preview)
        : hasOwn('last_message')
          ? target.last_message == null
            ? null
            : String(target.last_message)
          : undefined,
    last_message_id:
      hasOwn('last_message_id')
        ? toNumber(target.last_message_id, 0) || null
        : hasOwn('last_message') && target?.last_message?.id != null
          ? toNumber(target.last_message.id, 0) || null
          : undefined,
    last_message_at:
      hasOwn('last_message_at')
        ? target.last_message_at == null
          ? null
          : String(target.last_message_at)
        : hasOwn('created_at')
          ? target.created_at == null
            ? null
            : String(target.created_at)
          : undefined,
  }
}

function normalizeWsEventName(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  if (raw.startsWith('chat.')) return raw
  return raw ? `chat.${raw}` : ''
}

function extractWsMemberType(payload: any): 'admin' | 'client_account' | 'company_account' | null {
  const raw = payload?.member_type ?? payload?.actor_type ?? payload?.reader_type ?? payload?.sender_type ?? payload?.recipient_type
  if (raw === 'admin' || raw === 'client_account' || raw === 'company_account') return raw
  return null
}

function extractWsMemberId(payload: any): number {
  return toNumber(
    payload?.member_id ??
      payload?.actor_id ??
      payload?.reader_id ??
      payload?.sender_id ??
      payload?.recipient_id
  )
}

export default function WorkChatLauncher({ portalType, actor }: WorkChatLauncherProps) {
  const api = useMemo(
    () => (portalType === 'admin' ? adminWorkChatApi : clientWorkChatApi),
    [portalType]
  )
  const getErrorMessage = portalType === 'admin' ? getAdminWorkChatErrorMessage : getClientWorkChatErrorMessage

  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<LauncherTab>('rooms')
  const [rooms, setRooms] = useState<WorkChatRoom[]>([])
  const [roomsLoading, setRoomsLoading] = useState(false)
  const [participants, setParticipants] = useState<WorkChatParticipantsResponse>({
    admins: [],
    client_accounts: [],
    company_accounts: [],
  })
  const [participantsLoading, setParticipantsLoading] = useState(false)

  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)
  const [openedRoomIds, setOpenedRoomIds] = useState<number[]>([])
  const [messages, setMessages] = useState<WorkChatMessage[]>([])
  const [roomMessagesMap, setRoomMessagesMap] = useState<Record<number, WorkChatMessage[]>>({})
  const [roomMessagesLoadingMap, setRoomMessagesLoadingMap] = useState<Record<number, boolean>>({})
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [nextBeforeMessageId, setNextBeforeMessageId] = useState<number | null>(null)
  const [roomMessageBodyMap, setRoomMessageBodyMap] = useState<Record<number, string>>({})
  const [roomSendingMap, setRoomSendingMap] = useState<Record<number, boolean>>({})
  const [sending, setSending] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [isMessageComposing, setIsMessageComposing] = useState(false)
  const [roomMembers, setRoomMembers] = useState<WorkChatParticipant[]>([])
  const [roomActionMenuOpen, setRoomActionMenuOpen] = useState(false)
  const [showRoomMembersPanel, setShowRoomMembersPanel] = useState(false)
  const [leavingRoom, setLeavingRoom] = useState(false)
  const [leavingRoomId, setLeavingRoomId] = useState<number | null>(null)
  const [renamingRoomId, setRenamingRoomId] = useState<number | null>(null)
  const [updatingRoomPreference, setUpdatingRoomPreference] = useState(false)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [dragOverComposer, setDragOverComposer] = useState(false)
  const [savingAttachmentId, setSavingAttachmentId] = useState<number | null>(null)
  const [showSaveCompanyPanel, setShowSaveCompanyPanel] = useState(false)
  const [saveTargetAttachment, setSaveTargetAttachment] = useState<{
    attachmentId: number
    fileName: string
  } | null>(null)
  const [companySearchKeyword, setCompanySearchKeyword] = useState('')
  const [companyOptions, setCompanyOptions] = useState<CompanyTaxDetail[]>([])
  const [companyOptionsLoading, setCompanyOptionsLoading] = useState(false)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [saveDocumentTitle, setSaveDocumentTitle] = useState('')
  const [inlineAttachmentLoadingIds, setInlineAttachmentLoadingIds] = useState<Record<number, boolean>>({})
  const [imageViewer, setImageViewer] = useState<{
    url: string
    fileName: string
  } | null>(null)
  const [imageViewerMode, setImageViewerMode] = useState<'fit' | 'original'>('fit')
  const [imageViewerExpanded, setImageViewerExpanded] = useState(true)

  const [searchKeyword, setSearchKeyword] = useState('')
  const [includeHiddenRooms, setIncludeHiddenRooms] = useState(false)
  const [startingTargetKey, setStartingTargetKey] = useState<string | null>(null)
  const [showGroupCreateModal, setShowGroupCreateModal] = useState(false)
  const [groupRoomName, setGroupRoomName] = useState('')
  const [groupMemberSearchKeyword, setGroupMemberSearchKeyword] = useState('')
  const [groupSelectedKeys, setGroupSelectedKeys] = useState<Record<string, boolean>>({})
  const [creatingGroupRoom, setCreatingGroupRoom] = useState(false)
  const [showGroupCreateTooltip, setShowGroupCreateTooltip] = useState(false)
  const [showRoomSearchPanel, setShowRoomSearchPanel] = useState(false)
  const [roomSearchKeyword, setRoomSearchKeyword] = useState('')
  const [roomSearchResults, setRoomSearchResults] = useState<WorkChatMessageSearchItem[]>([])
  const [roomSearchTotal, setRoomSearchTotal] = useState(0)
  const [roomSearchLoading, setRoomSearchLoading] = useState(false)
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(-1)
  const [activeSearchMessageId, setActiveSearchMessageId] = useState<number | null>(null)
  const [jumpHighlightMessageId, setJumpHighlightMessageId] = useState<number | null>(null)
  const [roomContextMenu, setRoomContextMenu] = useState<{
    roomId: number
    x: number
    y: number
  } | null>(null)
  const [messageContextMenu, setMessageContextMenu] = useState<{
    messageId: number
    x: number
    y: number
  } | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [wsConnecting, setWsConnecting] = useState(false)
  const [wsCloseInfo, setWsCloseInfo] = useState<{ code: number; reason: string } | null>(null)
  const [presenceMap, setPresenceMap] = useState<Record<string, WsPresenceState>>({})
  const [typingMap, setTypingMap] = useState<Record<string, WsTypingState>>({})
  const [roomReadCursors, setRoomReadCursors] = useState<Record<number, RoomReadCursorState>>({})

  const [launcherSize, setLauncherSize] = useState({
    width: LAUNCHER_DEFAULT_WIDTH,
    height: LAUNCHER_DEFAULT_HEIGHT,
  })
  const [position, setPosition] = useState({ x: 24, y: 24 })
  const [positionReady, setPositionReady] = useState(false)
  const [chatWindowOpen, setChatWindowOpen] = useState(false)
  const [chatWindowSize, setChatWindowSize] = useState({
    width: CHAT_WINDOW_DEFAULT_WIDTH,
    height: CHAT_WINDOW_DEFAULT_HEIGHT,
  })
  const [chatWindowPosition, setChatWindowPosition] = useState({ x: 24, y: 24 })
  const [chatWindowPositionReady, setChatWindowPositionReady] = useState(false)
  const [secondaryWindowPositions, setSecondaryWindowPositions] = useState<
    Record<number, { x: number; y: number }>
  >({})
  const [secondaryWindowSizes, setSecondaryWindowSizes] = useState<
    Record<number, { width: number; height: number }>
  >({})
  const [activeWindowRoomId, setActiveWindowRoomId] = useState<number | null>(null)

  const launcherRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const chatWindowRef = useRef<HTMLDivElement | null>(null)
  const secondaryWindowRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const roomContextMenuRef = useRef<HTMLDivElement | null>(null)
  const messageContextMenuRef = useRef<HTMLDivElement | null>(null)
  const roomActionMenuRef = useRef<HTMLDivElement | null>(null)
  const chatWindowDragStateRef = useRef<{
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const chatWindowResizeStateRef = useRef<{
    mode: 'left' | 'right' | 'bottom' | 'corner'
    startX: number
    startY: number
    originX: number
    originWidth: number
    originHeight: number
  } | null>(null)
  const secondaryWindowDragStateRef = useRef<{
    roomId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const secondaryWindowResizeStateRef = useRef<{
    roomId: number
    mode: 'left' | 'right' | 'bottom' | 'corner'
    startX: number
    startY: number
    originX: number
    originY: number
    originWidth: number
    originHeight: number
  } | null>(null)
  const messageScrollRef = useRef<HTMLDivElement | null>(null)
  const firstOpenedRef = useRef(false)
  const wsRef = useRef<WebSocket | null>(null)
  const sendInFlightRef = useRef(false)
  const wsReconnectTimerRef = useRef<number | null>(null)
  const wsReconnectDelayRef = useRef(1000)
  const wsPingTimerRef = useRef<number | null>(null)
  const wsConnectedRef = useRef(false)
  const wsAuthBlockedRef = useRef(false)
  const wsAuthToastShownRef = useRef<number | null>(null)
  const selectedRoomIdRef = useRef<number | null>(null)
  const openedRoomIdsRef = useRef<number[]>([])
  const subscribedRoomIdsRef = useRef<Set<number>>(new Set())
  const enteredRoomIdRef = useRef<number | null>(null)
  const typingStopTimerRef = useRef<number | null>(null)
  const typingExpiryTimersRef = useRef<Map<string, number>>(new Map())
  const typingSentRef = useRef(false)
  const participantNameMapRef = useRef<Map<string, string>>(new Map())
  const participantAvatarMapRef = useRef<Map<string, string | null>>(new Map())
  const inlineAttachmentUrlRef = useRef<Record<number, { url: string; expiresAt: number }>>({})
  const inlineAttachmentLoadingRef = useRef<Set<number>>(new Set())
  const inlineAttachmentRetryRef = useRef<Set<number>>(new Set())
  const groupCreateTooltipTimerRef = useRef<number | null>(null)
  const jumpHighlightTimerRef = useRef<number | null>(null)
  const nextBeforeMessageIdRef = useRef<number | null>(null)

  const storagePositionKey = `work_chat_launcher_position_${portalType}`
  const chatWindowStoragePositionKey = `work_chat_window_position_${portalType}`
  const unreadTotal = useMemo(() => rooms.reduce((sum, room) => sum + (room.unread_count || 0), 0), [rooms])
  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) || null,
    [rooms, selectedRoomId]
  )
  const openedRooms = useMemo(
    () =>
      openedRoomIds
        .map((roomId) => rooms.find((room) => room.id === roomId))
        .filter((room): room is WorkChatRoom => Boolean(room)),
    [openedRoomIds, rooms]
  )
  const selectedRoomReadCursorState = useMemo(
    () => (selectedRoom ? roomReadCursors[selectedRoom.id] || {} : {}),
    [roomReadCursors, selectedRoom]
  )
  const canSaveToCompany = portalType === 'admin' || portalType === 'client'

  const getCachedInlineAttachmentUrl = useCallback((attachmentId: number): string | null => {
    const cached = inlineAttachmentUrlRef.current[attachmentId]
    if (!cached) return null
    if (cached.expiresAt <= Date.now() + 15_000) return null
    return cached.url
  }, [])

  const employeeRows = useMemo(() => {
    const rows = [...participants.admins, ...participants.client_accounts].filter(
      (row) => row.member_type === 'admin' || row.member_type === 'client_account'
    )
    return rows.filter((row) => !(row.member_type === actor.type && row.member_id === actor.id))
  }, [participants, actor.id, actor.type])
  const companyRows = useMemo(
    () => participants.company_accounts.filter((row) => row.member_type === 'company_account'),
    [participants.company_accounts]
  )
  const participantAvatarByName = useMemo(() => {
    const map = new Map<string, { avatarUrl: string | null; name: string }>()
    ;[...employeeRows, ...companyRows].forEach((row) => {
      const key = normalizeNameKey(row.name)
      if (!key) return
      if (!map.has(key)) {
        map.set(key, {
          avatarUrl: row.avatar_url || null,
          name: row.name,
        })
      }
    })
    return map
  }, [companyRows, employeeRows])
  const companyAvatarByCompanyId = useMemo(() => {
    const map = new Map<number, { avatarUrl: string | null; name: string }>()
    companyRows.forEach((row) => {
      const companyId = Number(row.company_id || 0)
      if (companyId <= 0) return
      if (!map.has(companyId)) {
        map.set(companyId, {
          avatarUrl: row.avatar_url || null,
          name: row.name,
        })
      }
    })
    return map
  }, [companyRows])

  const filteredEmployees = useMemo(
    () => employeeRows.filter((row) => includeByKeyword(row, searchKeyword)),
    [employeeRows, searchKeyword]
  )
  const filteredCompanies = useMemo(
    () => companyRows.filter((row) => includeByKeyword(row, searchKeyword)),
    [companyRows, searchKeyword]
  )
  const filteredRooms = useMemo(() => {
    const activeRooms = rooms.filter((room) => room.is_active !== false)
    const normalized = searchKeyword.trim().toLowerCase()
    if (!normalized) return activeRooms
    return activeRooms.filter((room) => {
      const title = (getRoomDisplayName(room) || '').toLowerCase()
      const preview = (room.last_message_preview || '').toLowerCase()
      return title.includes(normalized) || preview.includes(normalized)
    })
  }, [rooms, searchKeyword])
  const roomSearchMessageIdSet = useMemo(() => {
    const set = new Set<number>()
    roomSearchResults.forEach((item) => {
      if (item.message_id > 0) set.add(item.message_id)
    })
    return set
  }, [roomSearchResults])
  const activeSearchResult =
    activeSearchResultIndex >= 0 ? roomSearchResults[activeSearchResultIndex] || null : null
  const filteredGroupCandidates = useMemo(
    () => employeeRows.filter((row) => includeByKeyword(row, groupMemberSearchKeyword)),
    [employeeRows, groupMemberSearchKeyword]
  )
  const selectedGroupMembers = useMemo(
    () =>
      employeeRows.filter((row) => {
        const key = `${row.member_type}:${row.member_id}`
        return Boolean(groupSelectedKeys[key])
      }),
    [employeeRows, groupSelectedKeys]
  )

  const typingNamesInSelectedRoom = useMemo(() => {
    if (!selectedRoomId) return []
    return Object.values(typingMap)
      .filter((row) => row.roomId === selectedRoomId)
      .map((row) => row.name)
  }, [selectedRoomId, typingMap])

  const selectedRoomMemberSummary = useMemo(() => {
    if (!selectedRoom) return { label: '참여자', count: 0 }
    const sourceMembers = roomMembers.length > 0 ? roomMembers : selectedRoom.members || []
    const counterpartCount = sourceMembers.filter(
      (member) => !(member.member_type === actor.type && member.member_id === actor.id)
    ).length
    if (selectedRoom.room_type === 'direct') {
      return { label: '상대', count: counterpartCount }
    }
    return { label: '참여자', count: sourceMembers.length }
  }, [actor.id, actor.type, roomMembers, selectedRoom])

  const selectedRoomMembersForPanel = useMemo(() => {
    if (!selectedRoom) return [] as WorkChatParticipant[]
    return roomMembers.length > 0 ? roomMembers : selectedRoom.members || []
  }, [roomMembers, selectedRoom])

  const selectedRoomCounterpartKeys = useMemo(() => {
    if (!selectedRoom) return [] as string[]
    const sourceMembers = selectedRoomMembersForPanel
    return sourceMembers
      .filter((member) => !(member.member_type === actor.type && member.member_id === actor.id))
      .map((member) => toActorKey(member.member_type, member.member_id))
  }, [actor.id, actor.type, selectedRoom, selectedRoomMembersForPanel])

  useEffect(() => {
    const map = new Map<string, string>()
    const avatarMap = new Map<string, string | null>()
    ;[
      ...participants.admins,
      ...participants.client_accounts,
      ...participants.company_accounts,
      ...roomMembers,
    ].forEach((row) => {
      const actorKey = toActorKey(row.member_type, row.member_id)
      map.set(actorKey, row.name)
      avatarMap.set(actorKey, row.avatar_url || null)
    })
    participantNameMapRef.current = map
    participantAvatarMapRef.current = avatarMap
  }, [participants, roomMembers])

  const clampPosition = useCallback((x: number, y: number, width: number, height: number) => {
    const minX = 8
    const minY = 8
    const maxX = Math.max(minX, window.innerWidth - width - 8)
    const maxY = Math.max(minY, window.innerHeight - height - 8)
    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    }
  }, [])

  const clampSecondaryPosition = useCallback((x: number, y: number, width: number, height: number) => {
    const minX = 8
    const minY = 8
    const maxX = Math.max(minX, window.innerWidth - width - 8)
    const maxY = Math.max(minY, window.innerHeight - height - 8)
    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    }
  }, [])

  const loadRooms = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setRoomsLoading(true)
      const res = await api.listRooms({ page: 1, size: 50, include_hidden: includeHiddenRooms })
      const next = sortRoomsByRecentMessage((res.items || []).filter((room) => room.is_active !== false))
      setRooms(next)
      return next
    } catch (error) {
      if (!options?.silent) toast.error(getErrorMessage(error))
      return []
    } finally {
      if (!options?.silent) setRoomsLoading(false)
    }
  }, [api, getErrorMessage, includeHiddenRooms])

  const handleInaccessibleRoom = useCallback(
    (roomId: number, options?: { silent?: boolean }) => {
      const nextOpened = openedRoomIdsRef.current.filter((id) => id !== roomId)
      setRooms((prev) => prev.filter((room) => room.id !== roomId))
      setOpenedRoomIds(nextOpened)
      setActiveWindowRoomId((prev) => (prev === roomId ? nextOpened.at(-1) ?? null : prev))
      setSecondaryWindowPositions((prev) => {
        const next = { ...prev }
        delete next[roomId]
        return next
      })
      setSecondaryWindowSizes((prev) => {
        const next = { ...prev }
        delete next[roomId]
        return next
      })
      setRoomMessagesMap((prev) => {
        const next = { ...prev }
        delete next[roomId]
        return next
      })
      setRoomMessageBodyMap((prev) => {
        const next = { ...prev }
        delete next[roomId]
        return next
      })
      if (selectedRoomIdRef.current === roomId) {
        const fallbackRoomId = openedRoomIdsRef.current.filter((id) => id !== roomId).at(-1) ?? null
        if (fallbackRoomId) {
          setSelectedRoomId(fallbackRoomId)
          setChatWindowOpen(true)
        } else {
          setChatWindowOpen(false)
          setSelectedRoomId(null)
        }
        setMessages([])
        setRoomMembers([])
        setRoomActionMenuOpen(false)
        setShowRoomMembersPanel(false)
        setShowSaveCompanyPanel(false)
        setSaveTargetAttachment(null)
        setImageViewer(null)
        setShowRoomSearchPanel(false)
        setRoomSearchKeyword('')
        setRoomSearchResults([])
        setRoomSearchTotal(0)
        setActiveSearchResultIndex(-1)
        setActiveSearchMessageId(null)
        setJumpHighlightMessageId(null)
        setActiveTab('rooms')
      }
      if (!options?.silent) {
        toast.error('접근할 수 없는 대화방입니다. 목록을 갱신합니다.')
      }
      void loadRooms({ silent: true })
    },
    [loadRooms]
  )

  const loadParticipants = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setParticipantsLoading(true)
      }
      const [participantRows, presenceRows] = await Promise.all([
        api.listParticipants(),
        api.listParticipantsPresence(),
      ])
      setParticipants(mergeParticipantsWithPresence(participantRows, presenceRows))
    } catch (error) {
      try {
        const participantRows = await api.listParticipants()
        setParticipants(participantRows)
      } catch {
        if (!options?.silent) toast.error(getErrorMessage(error))
      }
    } finally {
      if (!options?.silent) {
        setParticipantsLoading(false)
      }
    }
  }, [api, getErrorMessage])

  const sendWsEvent = useCallback((event: string, data: Record<string, unknown> = {}) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    ws.send(JSON.stringify({ event, data }))
    return true
  }, [])

  const markRoomRead = useCallback(
    async (roomId: number, lastReadMessageId?: number | null) => {
      const sentByWs = sendWsEvent('chat.read', {
        room_id: roomId,
        last_read_message_id: lastReadMessageId ?? undefined,
      })
      if (!sentByWs) {
        try {
          await api.markRead(roomId, lastReadMessageId ?? undefined)
        } catch {
          return
        }
      }
      setRooms((prev) =>
        prev.map((room) =>
          room.id === roomId
            ? {
                ...room,
                unread_count: 0,
                unread_count_display: '0',
              }
            : room
        )
      )
    },
    [api, sendWsEvent]
  )

  const markSelectedRoomRead = useCallback(
    async (roomId: number, currentMessages: WorkChatMessage[]) => {
      const lastMessage = currentMessages[currentMessages.length - 1]
      await markRoomRead(roomId, lastMessage?.id ?? undefined)
    },
    [markRoomRead]
  )

  const loadRoomMembers = useCallback(
    async (
      roomId: number,
      options?: { failOnAccess?: boolean; silent?: boolean; skipStateUpdate?: boolean }
    ) => {
      try {
        const rows = await api.listRoomMembers(roomId)
        if (!options?.skipStateUpdate) {
          setRoomMembers(rows)
        }
        return rows
      } catch (error) {
        if (!options?.skipStateUpdate) {
          setRoomMembers([])
        }
        if (isRoomAccessError(error)) {
          handleInaccessibleRoom(roomId, { silent: options?.silent })
          if (options?.failOnAccess) throw error
          return []
        }
        if (options?.failOnAccess) {
          throw new Error('ROOM_MEMBERS_LOAD_FAILED')
        }
        return []
      }
    },
    [api, handleInaccessibleRoom]
  )

  const mergeRoomReadCursor = useCallback(
    (roomId: number, cursor: WorkChatReadCursor | { member_type: string; member_id: number; last_read_message_id: number | null }) => {
      const memberType = cursor.member_type
      const memberId = Number(cursor.member_id || 0)
      if (
        roomId <= 0 ||
        memberId <= 0 ||
        (memberType !== 'admin' && memberType !== 'client_account' && memberType !== 'company_account')
      ) {
        return
      }
      const actorKey = toActorKey(memberType, memberId)
      const lastReadMessageId =
        cursor.last_read_message_id == null ? 0 : Math.max(0, Number(cursor.last_read_message_id) || 0)
      setRoomReadCursors((prev) => {
        const roomState = prev[roomId] || {}
        if ((roomState[actorKey] || 0) === lastReadMessageId) return prev
        return {
          ...prev,
          [roomId]: {
            ...roomState,
            [actorKey]: lastReadMessageId,
          },
        }
      })
    },
    []
  )

  const loadReadCursors = useCallback(
    async (roomId: number, options?: { failOnAccess?: boolean; silent?: boolean }) => {
      try {
        const rows = await api.listReadCursors(roomId)
        const nextRoomState: RoomReadCursorState = {}
        rows.forEach((row) => {
          const actorKey = toActorKey(row.member_type, row.member_id)
          nextRoomState[actorKey] = Math.max(0, Number(row.last_read_message_id || 0))
        })
        setRoomReadCursors((prev) => ({
          ...prev,
          [roomId]: nextRoomState,
        }))
        return rows
      } catch (error) {
        if (isRoomAccessError(error)) {
          handleInaccessibleRoom(roomId, { silent: options?.silent })
          if (options?.failOnAccess) throw error
          return []
        }
        if (options?.failOnAccess) throw error
        // read-cursors endpoint may be unavailable on older backend builds.
        return []
      }
    },
    [api, handleInaccessibleRoom]
  )

  const loadMessages = useCallback(
    async (
      roomId: number,
      options?: { beforeMessageId?: number | null; prepend?: boolean; silent?: boolean; failOnAccess?: boolean }
    ) => {
      try {
        setRoomMessagesLoadingMap((prev) => ({ ...prev, [roomId]: true }))
        if (options?.prepend) setLoadingHistory(true)
        else if (!options?.silent) setMessagesLoading(true)

        const res = await api.listMessages(roomId, {
          size: 50,
          before_message_id: options?.beforeMessageId ?? undefined,
        })
        const sortedIncoming = (res.items || []).sort((a, b) => a.id - b.id)
        if (roomId === selectedRoomIdRef.current) {
          setNextBeforeMessageId(res.next_before_message_id)
        }
        if (options?.prepend) {
          setRoomMessagesMap((prev) => {
            const base = prev[roomId] || []
            return {
              ...prev,
              [roomId]: mergeAndSortMessages(sortedIncoming, base),
            }
          })
          setMessages((prev) => {
            const merged = [...(res.items || []), ...prev]
            const dedup = new Map<number, WorkChatMessage>()
            merged.forEach((row) => dedup.set(row.id, row))
            return Array.from(dedup.values()).sort((a, b) => a.id - b.id)
          })
        } else {
          setRoomMessagesMap((prev) => ({ ...prev, [roomId]: sortedIncoming }))
          if (roomId === selectedRoomIdRef.current) {
            setMessages(sortedIncoming)
          }
          await markSelectedRoomRead(roomId, sortedIncoming)
        }
      } catch (error) {
        if (isRoomAccessError(error)) {
          handleInaccessibleRoom(roomId, { silent: options?.silent })
          if (options?.failOnAccess) throw error
        } else {
          if (!options?.silent) toast.error(getErrorMessage(error))
          if (options?.failOnAccess) throw error
        }
      } finally {
        setRoomMessagesLoadingMap((prev) => ({ ...prev, [roomId]: false }))
        if (options?.prepend) setLoadingHistory(false)
        else if (!options?.silent) setMessagesLoading(false)
      }
    },
    [api, getErrorMessage, handleInaccessibleRoom, markSelectedRoomRead]
  )

  const openRoom = useCallback(
    async (roomId: number) => {
      const room = rooms.find((row) => row.id === roomId)
      if (room && room.is_active === false) {
        handleInaccessibleRoom(roomId)
        return false
      }
      try {
        const previousSelectedRoomId = selectedRoomIdRef.current
        const hasMainWindow = Boolean(chatWindowOpen && previousSelectedRoomId)
        const switchToMain = !hasMainWindow || previousSelectedRoomId === roomId
        if (switchToMain && previousSelectedRoomId && previousSelectedRoomId !== roomId) {
          setSecondaryWindowPositions((prev) => {
            if (prev[previousSelectedRoomId]) return prev
            return {
              ...prev,
              [previousSelectedRoomId]: {
                x: chatWindowPosition.x,
                y: chatWindowPosition.y,
              },
            }
          })
          setSecondaryWindowSizes((prev) => {
            if (prev[previousSelectedRoomId]) return prev
            return {
              ...prev,
              [previousSelectedRoomId]: {
                width: chatWindowSize.width,
                height: chatWindowSize.height,
              },
            }
          })
        }
        await loadRoomMembers(roomId, {
          failOnAccess: true,
          skipStateUpdate: !switchToMain,
        })
        setOpenedRoomIds((prev) => (prev.includes(roomId) ? prev : [...prev, roomId]))
        setRoomMessageBodyMap((prev) => (prev[roomId] != null ? prev : { ...prev, [roomId]: '' }))
        setActiveWindowRoomId(roomId)
        setChatWindowOpen(true)
        if (switchToMain) {
          setSelectedRoomId(roomId)
        }
        setActiveTab('rooms')
        await Promise.all([
          loadMessages(roomId, { failOnAccess: true }),
          loadReadCursors(roomId, { failOnAccess: true }),
        ])
        if (switchToMain) {
          requestAnimationFrame(() => {
            if (messageScrollRef.current) {
              messageScrollRef.current.scrollTop = messageScrollRef.current.scrollHeight
            }
          })
        }
        return true
      } catch (error) {
        if (isRoomAccessError(error)) {
          handleInaccessibleRoom(roomId)
          return false
        }
        toast.error(getErrorMessage(error))
        return false
      }
    },
    [
      chatWindowOpen,
      chatWindowPosition.x,
      chatWindowPosition.y,
      chatWindowSize.height,
      chatWindowSize.width,
      getErrorMessage,
      handleInaccessibleRoom,
      loadMessages,
      loadReadCursors,
      loadRoomMembers,
      rooms,
    ]
  )

  const closeRoomTab = useCallback(
    (roomId: number) => {
      const nextOpened = openedRoomIdsRef.current.filter((id) => id !== roomId)
      setOpenedRoomIds(nextOpened)
      setActiveWindowRoomId((prev) => (prev === roomId ? nextOpened.at(-1) ?? null : prev))
      setSecondaryWindowPositions((prev) => {
        const next = { ...prev }
        delete next[roomId]
        return next
      })
      setSecondaryWindowSizes((prev) => {
        const next = { ...prev }
        delete next[roomId]
        return next
      })
      setRoomMessagesMap((prev) => {
        const next = { ...prev }
        delete next[roomId]
        return next
      })
      setRoomMessageBodyMap((prev) => {
        const next = { ...prev }
        delete next[roomId]
        return next
      })
      const closingSelected = selectedRoomIdRef.current === roomId
      if (!closingSelected) return

      const fallbackRoomId = nextOpened.at(-1) ?? null
      if (fallbackRoomId) {
        setSelectedRoomId(fallbackRoomId)
        setChatWindowOpen(true)
        void Promise.all([
          loadRoomMembers(fallbackRoomId, { silent: true }),
          loadMessages(fallbackRoomId, { silent: true }),
          loadReadCursors(fallbackRoomId, { silent: true }),
        ])
      } else {
        setChatWindowOpen(false)
        setSelectedRoomId(null)
      }

      setMessageContextMenu(null)
      setMessages([])
      setRoomMembers([])
      setRoomActionMenuOpen(false)
      setShowRoomMembersPanel(false)
      setShowSaveCompanyPanel(false)
      setSaveTargetAttachment(null)
      setImageViewer(null)
      setShowRoomSearchPanel(false)
      setRoomSearchKeyword('')
      setRoomSearchResults([])
      setRoomSearchTotal(0)
      setActiveSearchResultIndex(-1)
      setActiveSearchMessageId(null)
      setJumpHighlightMessageId(null)
    },
    [loadMessages, loadReadCursors, loadRoomMembers]
  )

  const closeChatWindow = useCallback(() => {
    if (selectedRoomIdRef.current) {
      closeRoomTab(selectedRoomIdRef.current)
      return
    }
    setChatWindowOpen(false)
    setSelectedRoomId(null)
    setOpenedRoomIds([])
    setActiveWindowRoomId(null)
    setSecondaryWindowPositions({})
    setSecondaryWindowSizes({})
    setMessageContextMenu(null)
    setMessages([])
    setRoomMembers([])
    setRoomActionMenuOpen(false)
    setShowRoomMembersPanel(false)
    setShowSaveCompanyPanel(false)
    setSaveTargetAttachment(null)
    setImageViewer(null)
    setShowRoomSearchPanel(false)
    setRoomSearchKeyword('')
    setRoomSearchResults([])
    setRoomSearchTotal(0)
    setActiveSearchResultIndex(-1)
    setActiveSearchMessageId(null)
    setJumpHighlightMessageId(null)
  }, [closeRoomTab])

  const handleViewRoomMembers = useCallback(async () => {
    if (!selectedRoom) return
    setRoomActionMenuOpen(false)
    setShowRoomMembersPanel(true)
    if (selectedRoomMembersForPanel.length === 0) {
      await loadRoomMembers(selectedRoom.id)
    }
  }, [loadRoomMembers, selectedRoom, selectedRoomMembersForPanel.length])

  const handleLeaveRoomByRoom = useCallback(
    async (room: WorkChatRoom, options?: { closeActionMenu?: boolean }) => {
      if (leavingRoomId === room.id) return
      const confirmed = window.confirm(
        room.room_type === 'company_bridge'
          ? '회사 채팅방은 퇴장 대신 목록 숨김 처리됩니다. 진행하시겠습니까?'
          : '대화방에서 나가시겠습니까?'
      )
      if (!confirmed) return

      try {
        setLeavingRoom(true)
        setLeavingRoomId(room.id)
        const res = await api.leaveRoom(room.id)
        if (room.room_type === 'company_bridge' && includeHiddenRooms) {
          setRooms((prev) =>
            prev.map((row) =>
              row.id === room.id
                ? { ...row, is_hidden: true }
                : row
            )
          )
        } else {
          setRooms((prev) => prev.filter((row) => row.id !== room.id))
        }
        if (selectedRoomId === room.id) {
          closeChatWindow()
          setActiveTab('rooms')
        }
        toast.success(res?.message || '처리되었습니다.')
        void loadRooms({ silent: true })
      } catch (error) {
        toast.error(getErrorMessage(error))
      } finally {
        setLeavingRoom(false)
        setLeavingRoomId((prev) => (prev === room.id ? null : prev))
        if (options?.closeActionMenu) {
          setRoomActionMenuOpen(false)
        }
      }
    },
    [api, closeChatWindow, getErrorMessage, includeHiddenRooms, leavingRoomId, loadRooms, selectedRoomId]
  )

  const handleLeaveRoom = useCallback(async () => {
    if (!selectedRoom || leavingRoom) return
    await handleLeaveRoomByRoom(selectedRoom, { closeActionMenu: true })
  }, [handleLeaveRoomByRoom, leavingRoom, selectedRoom])

  const handleHideCurrentRoom = useCallback(async () => {
    if (!selectedRoom || updatingRoomPreference) return
    const nextHidden = !Boolean(selectedRoom.is_hidden)
    try {
      setUpdatingRoomPreference(true)
      const updatedRoom = await api.updateRoomPreference(selectedRoom.id, { is_hidden: nextHidden })
      if (nextHidden) {
        if (includeHiddenRooms) {
          setRooms((prev) =>
            prev.map((room) =>
              room.id === selectedRoom.id
                ? { ...room, ...updatedRoom, is_hidden: true }
                : room
            )
          )
        } else {
          setRooms((prev) => prev.filter((room) => room.id !== selectedRoom.id))
        }
        closeChatWindow()
        setActiveTab('rooms')
      } else {
        setRooms((prev) =>
          prev.map((room) =>
            room.id === selectedRoom.id
              ? { ...room, ...updatedRoom, is_hidden: false }
              : room
          )
        )
      }
      setRoomActionMenuOpen(false)
      toast.success(nextHidden ? '채팅방을 목록에서 숨겼습니다.' : '채팅방 숨김을 해제했습니다.')
      void loadRooms({ silent: true })
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setUpdatingRoomPreference(false)
    }
  }, [api, closeChatWindow, getErrorMessage, includeHiddenRooms, loadRooms, selectedRoom, updatingRoomPreference])

  const handleToggleMuteCurrentRoom = useCallback(async () => {
    if (!selectedRoom || updatingRoomPreference) return
    const nextMuted = !Boolean(selectedRoom.is_muted)
    try {
      setUpdatingRoomPreference(true)
      const updatedRoom = await api.updateRoomPreference(selectedRoom.id, {
        is_muted: nextMuted,
        muted_until: null,
      })
      setRooms((prev) =>
        prev.map((room) =>
          room.id === selectedRoom.id
            ? { ...room, ...updatedRoom }
            : room
        )
      )
      setRoomActionMenuOpen(false)
      toast.success(nextMuted ? '알림을 껐습니다.' : '알림을 켰습니다.')
      void loadRooms({ silent: true })
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setUpdatingRoomPreference(false)
    }
  }, [api, getErrorMessage, loadRooms, selectedRoom, updatingRoomPreference])

  const getDefaultGroupRoomName = useCallback((members: WorkChatParticipant[]) => {
    const names = members
      .map((member) => member.name?.trim())
      .filter((name): name is string => Boolean(name))
    if (names.length === 0) return ''
    const joined = names.join(', ')
    if (joined.length <= 120) return joined
    return `${joined.slice(0, 117)}...`
  }, [])

  const handleRenameRoom = useCallback(
    async (room: WorkChatRoom, options?: { closeActionMenu?: boolean }) => {
      if (renamingRoomId) return
      if (!room || room.room_type !== 'group') return

      const currentName = getRoomDisplayName(room)
      const inputName = window.prompt('대화방 이름을 입력해 주세요.', currentName || '')
      if (inputName == null) return
      const nextName = inputName.trim()
      if (!nextName) {
        toast.error('대화방 이름을 입력해 주세요.')
        return
      }

      const currentRawName = (room.display_name || room.name || '').trim()
      if (currentRawName && currentRawName === nextName) return

      try {
        setRenamingRoomId(room.id)
        const updatedRoom = await api.renameRoom(room.id, nextName)
        setRooms((prev) =>
          prev.map((row) =>
            row.id === room.id
              ? {
                  ...row,
                  ...updatedRoom,
                  name: updatedRoom.name || nextName,
                  display_name: updatedRoom.display_name || updatedRoom.name || nextName,
                }
              : row
          )
        )
        toast.success('대화방 이름을 변경했습니다.')
        void loadRooms({ silent: true })
      } catch (error) {
        toast.error(getErrorMessage(error))
      } finally {
        setRenamingRoomId(null)
        if (options?.closeActionMenu) {
          setRoomActionMenuOpen(false)
        }
      }
    },
    [api, getErrorMessage, loadRooms, renamingRoomId]
  )

  const handleStartChat = useCallback(
    async (target: WorkChatParticipant) => {
      const key = `${target.member_type}:${target.member_id}`
      if (startingTargetKey) return
      const roomType: 'company_bridge' | 'direct' =
        target.member_type === 'company_account' ? 'company_bridge' : 'direct'
      const createPayload: WorkChatCreateRoomRequest = {
        room_type: roomType,
        members: [
          {
            member_type: target.member_type,
            member_id: target.member_id,
          },
        ],
      }
      const validateRoomForTarget = async (roomId: number) => {
        if (!Number.isFinite(roomId) || roomId <= 0) {
          throw new Error('ROOM_ACCESS_MISMATCH')
        }
        const members = await api.listRoomMembers(roomId)
        const hasTarget = members.some(
          (member) =>
            member.member_type === target.member_type &&
            member.member_id === target.member_id
        )
        const hasMe = members.some(
          (member) =>
            member.member_type === actor.type &&
            member.member_id === actor.id
        )
        if (!hasTarget || !hasMe) {
          throw new Error('ROOM_ACCESS_MISMATCH')
        }
      }
      try {
        setStartingTargetKey(key)
        // 기존 선택 room에서 발생할 수 있는 잔존 polling 호출 차단
        setSelectedRoomId(null)
        // company_bridge는 기존 목록/캐시를 신뢰하지 않고
        // 항상 생성/재사용 API를 먼저 호출해서 현재 actor 멤버십이 보장된 room_id로 진입한다.
        const res = await api.createRoom(createPayload)
        setRooms((prev) => {
          const base = (res.room || {}) as WorkChatRoom
          if (!base.id) return prev
          const unreadCount = Math.max(0, Number(base.unread_count || 0))
          if (base.is_active === false) return prev
          const nextRoom: WorkChatRoom = {
            ...base,
            is_active: base.is_active ?? true,
            unread_count: unreadCount,
            unread_count_display: base.unread_count_display || toUnreadCountDisplay(unreadCount),
          }
          const next = [nextRoom, ...prev.filter((room) => room.id !== nextRoom.id)]
          return sortRoomsByRecentMessage(next)
        })
        const createdRoomId = Number((res?.room as any)?.id || 0)
        await validateRoomForTarget(createdRoomId)
        const opened = await openRoom(createdRoomId)
        if (!opened) {
          throw new Error('ROOM_ACCESS_MISMATCH')
        }
        void loadRooms({ silent: true })
      } catch (error) {
        const isConflict = axios.isAxiosError(error) && error.response?.status === 409
        const isAccessMismatch =
          error instanceof Error && error.message === 'ROOM_ACCESS_MISMATCH'
        if (isConflict || isAccessMismatch) {
          try {
            if (isConflict) {
              // race로 인한 409일 수 있으므로 create를 짧게 재시도한다.
              for (let retry = 0; retry < 3; retry += 1) {
                await wait(220 * (retry + 1))
                try {
                  const retried = await api.createRoom(createPayload)
                  const retriedRoomId = Number((retried?.room as any)?.id || 0)
                  if (retriedRoomId > 0) {
                    await validateRoomForTarget(retriedRoomId)
                    setRooms((prev) => {
                      const base = (retried.room || {}) as WorkChatRoom
                      if (base.is_active === false) return prev
                      const unreadCount = Math.max(0, Number(base.unread_count || 0))
                      const nextRoom: WorkChatRoom = {
                        ...base,
                        is_active: base.is_active ?? true,
                        unread_count: unreadCount,
                        unread_count_display:
                          base.unread_count_display || toUnreadCountDisplay(unreadCount),
                      }
                      return sortRoomsByRecentMessage([
                        nextRoom,
                        ...prev.filter((room) => room.id !== nextRoom.id),
                      ])
                    })
                    const opened = await openRoom(retriedRoomId)
                    if (!opened) {
                      throw new Error('ROOM_ACCESS_MISMATCH')
                    }
                    void loadRooms({ silent: true })
                    return
                  }
                } catch (retryError) {
                  if (
                    !axios.isAxiosError(retryError) ||
                    retryError.response?.status !== 409
                  ) {
                    throw retryError
                  }
                }
              }
            }

            const fallbackRoomType = roomType
            const findExistingRoom = (rows: WorkChatRoom[]) =>
              rows.find((room) => {
                if (room.is_active === false) return false
                if (target.member_type === 'company_account') {
                  const memberMatched = Array.isArray(room.members)
                    ? room.members.some(
                        (member) =>
                          member.member_type === 'company_account' &&
                          member.member_id === target.member_id
                      )
                    : false
                  const companyMatched =
                    target.company_id != null &&
                    room.company_id != null &&
                    Number(target.company_id) === Number(room.company_id)
                  const title = `${room.display_name || ''} ${room.name || ''}`.trim()
                  const titleMatched = Boolean(target.name?.trim()) && title === target.name.trim()
                  return memberMatched || companyMatched || titleMatched
                }

                if (target.member_type === 'admin' || target.member_type === 'client_account') {
                  if (!Array.isArray(room.members)) return false
                  const hasTarget = room.members.some(
                    (member) =>
                      member.member_type === target.member_type &&
                      member.member_id === target.member_id
                  )
                  const hasMe = room.members.some(
                    (member) =>
                      member.member_type === actor.type &&
                      member.member_id === actor.id
                  )
                  return hasTarget && hasMe
                }
                return false
              })

            for (let attempt = 0; attempt < 3; attempt += 1) {
              if (attempt > 0) {
                await wait(250 * attempt)
              }
              const refreshed = await api.listRooms({
                page: 1,
                size: 100,
                room_type: fallbackRoomType,
                include_hidden: true,
              })
              const refreshedRooms = sortRoomsByRecentMessage(
                (refreshed.items || []).filter((room) => room.is_active !== false)
              )
              setRooms((prev) => {
                const others = prev.filter((room) => room.room_type !== fallbackRoomType)
                return sortRoomsByRecentMessage([...others, ...refreshedRooms])
              })
              const existing = findExistingRoom(refreshedRooms)
              if (existing?.id) {
                await validateRoomForTarget(existing.id)
                const opened = await openRoom(existing.id)
                if (!opened) {
                  throw new Error('ROOM_ACCESS_MISMATCH')
                }
                void loadRooms({ silent: true })
                return
              }
            }

            // 목록만으로 매칭이 안 되면 멤버 조회로 최종 매칭 시도(백엔드 응답 형태 차이 대응).
            const memberFallback = await api.listRooms({
              page: 1,
              size: 100,
              room_type: fallbackRoomType,
              include_hidden: true,
            })
            const candidates = sortRoomsByRecentMessage(
              (memberFallback.items || []).filter((room) => room.is_active !== false)
            ).slice(0, 30)
            for (const candidate of candidates) {
              try {
                const members = await api.listRoomMembers(candidate.id)
                const hasTarget = members.some(
                  (member) =>
                    member.member_type === target.member_type &&
                    member.member_id === target.member_id
                )
                const hasMe = members.some(
                  (member) =>
                  member.member_type === actor.type &&
                  member.member_id === actor.id
                )
                if (hasTarget && hasMe) {
                  const opened = await openRoom(candidate.id)
                  if (!opened) {
                    throw new Error('ROOM_ACCESS_MISMATCH')
                  }
                  void loadRooms({ silent: true })
                  return
                }
              } catch {
                // 접근 불가 방은 skip
              }
            }
          } catch {
            // Fall through to error handling below.
          }
          toast.error('대화방을 찾지 못했습니다. 잠시 후 다시 시도해 주세요.')
          return
        }
        toast.error(getErrorMessage(error))
      } finally {
        setStartingTargetKey(null)
      }
    },
    [actor.id, actor.type, api, getErrorMessage, loadRooms, openRoom, startingTargetKey]
  )

  const handleOpenGroupCreateModal = useCallback(async () => {
    setShowGroupCreateModal(true)
    setShowGroupCreateTooltip(false)
    setGroupRoomName('')
    setGroupMemberSearchKeyword('')
    setGroupSelectedKeys({})
    if (
      participants.admins.length === 0 &&
      participants.client_accounts.length === 0 &&
      participants.company_accounts.length === 0
    ) {
      await loadParticipants({ silent: true })
    }
  }, [loadParticipants, participants.admins.length, participants.client_accounts.length, participants.company_accounts.length])

  const handleCloseGroupCreateModal = useCallback(() => {
    setShowGroupCreateModal(false)
    setGroupMemberSearchKeyword('')
    setGroupRoomName('')
    setGroupSelectedKeys({})
    setCreatingGroupRoom(false)
  }, [])

  const toggleGroupCandidate = useCallback((target: WorkChatParticipant) => {
    const key = `${target.member_type}:${target.member_id}`
    setGroupSelectedKeys((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleCreateGroupRoom = useCallback(async () => {
    if (creatingGroupRoom) return
    if (selectedGroupMembers.length < 2) {
      toast.error('그룹채팅은 최소 2명을 선택해 주세요.')
      return
    }
    try {
      setCreatingGroupRoom(true)
      const manualName = groupRoomName.trim()
      const defaultName = getDefaultGroupRoomName(selectedGroupMembers)
      const roomName = manualName || defaultName || undefined
      const res = await api.createRoom({
        room_type: 'group',
        name: roomName,
        members: selectedGroupMembers.map((member) => ({
          member_type: member.member_type,
          member_id: member.member_id,
        })),
      })
      setRooms((prev) => {
        const base = (res.room || {}) as WorkChatRoom
        if (!base.id) return prev
        if (base.is_active === false) return prev
        const unreadCount = Math.max(0, Number(base.unread_count || 0))
        const nextRoom: WorkChatRoom = {
          ...base,
          is_active: base.is_active ?? true,
          unread_count: unreadCount,
          unread_count_display: base.unread_count_display || toUnreadCountDisplay(unreadCount),
        }
        return sortRoomsByRecentMessage([nextRoom, ...prev.filter((room) => room.id !== nextRoom.id)])
      })
      handleCloseGroupCreateModal()
      setActiveTab('rooms')
      const opened = await openRoom(res.room.id)
      if (!opened) {
        throw new Error('ROOM_ACCESS_MISMATCH')
      }
      void loadRooms({ silent: true })
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        try {
          const refreshed = await api.listRooms({
            page: 1,
            size: 100,
            room_type: 'group',
            include_hidden: true,
          })
          const activeGroups = sortRoomsByRecentMessage(
            (refreshed.items || []).filter((room) => room.is_active !== false)
          )
          setRooms((prev) => {
            const others = prev.filter((room) => room.room_type !== 'group')
            return sortRoomsByRecentMessage([...others, ...activeGroups])
          })

          const requiredKeySet = buildActorKeySet([
            ...selectedGroupMembers.map((member) => ({
              member_type: member.member_type,
              member_id: member.member_id,
            })),
            {
              member_type: actor.type,
              member_id: actor.id,
            },
          ])
          const candidates = activeGroups.slice(0, 30)

          for (const candidate of candidates) {
            try {
              const members = await api.listRoomMembers(candidate.id)
              const candidateKeySet = buildActorKeySet(members)
              if (candidateKeySet.size !== requiredKeySet.size) continue
              const isExactMatch = Array.from(requiredKeySet).every((key) => candidateKeySet.has(key))
              if (!isExactMatch) continue

              handleCloseGroupCreateModal()
              setActiveTab('rooms')
              const opened = await openRoom(candidate.id)
              if (!opened) continue
              void loadRooms({ silent: true })
              return
            } catch {
              // skip inaccessible room
            }
          }

          toast.error('기존 그룹 대화방을 찾지 못했습니다. 잠시 후 다시 시도해 주세요.')
        } catch {
          toast.error(getErrorMessage(error))
        }
        return
      }
      toast.error(getErrorMessage(error))
    } finally {
      setCreatingGroupRoom(false)
    }
  }, [
    actor.id,
    actor.type,
    api,
    creatingGroupRoom,
    getDefaultGroupRoomName,
    getErrorMessage,
    groupRoomName,
    handleCloseGroupCreateModal,
    loadRooms,
    openRoom,
    selectedGroupMembers,
  ])

  const jumpToMessageInSelectedRoom = useCallback(
    async (messageId: number) => {
      if (!selectedRoom || messageId <= 0) return

      const tryScroll = () => {
        const target = document.getElementById(`chat-msg-${messageId}`)
        if (!target) return false
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setJumpHighlightMessageId(messageId)
        if (jumpHighlightTimerRef.current) {
          window.clearTimeout(jumpHighlightTimerRef.current)
        }
        jumpHighlightTimerRef.current = window.setTimeout(() => {
          setJumpHighlightMessageId((prev) => (prev === messageId ? null : prev))
          jumpHighlightTimerRef.current = null
        }, 1600)
        return true
      }

      if (tryScroll()) return

      let cursor = nextBeforeMessageIdRef.current
      let guard = 0
      while (cursor && guard < 20) {
        guard += 1
        const older = await api.listMessages(selectedRoom.id, {
          size: 50,
          before_message_id: cursor,
        })
        const olderItems = (older.items || []).sort((a, b) => a.id - b.id)
        setMessages((prev) => {
          const merged = [...olderItems, ...prev]
          const dedup = new Map<number, WorkChatMessage>()
          merged.forEach((row) => dedup.set(row.id, row))
          return Array.from(dedup.values()).sort((a, b) => a.id - b.id)
        })
        setNextBeforeMessageId(older.next_before_message_id)
        nextBeforeMessageIdRef.current = older.next_before_message_id
        cursor = older.next_before_message_id
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        if (tryScroll()) return
      }

      toast.error('검색 결과 메시지를 현재 기록에서 찾지 못했습니다.')
    },
    [api, selectedRoom]
  )

  const executeRoomSearch = useCallback(async () => {
    if (!selectedRoom) return
    const keyword = roomSearchKeyword.trim()
    if (keyword.length < 2) {
      toast.error('검색어는 2자 이상 입력해 주세요.')
      return
    }
    try {
      setRoomSearchLoading(true)
      const res = await api.searchMessages(selectedRoom.id, {
        q: keyword,
        page: 1,
        size: 50,
      })
      const items = res.items || []
      setRoomSearchResults(items)
      setRoomSearchTotal(Number(res.total || items.length || 0))
      if (items.length === 0) {
        setActiveSearchResultIndex(-1)
        setActiveSearchMessageId(null)
        toast('검색 결과가 없습니다.')
        return
      }
      const firstMessageId = items[0].message_id
      setActiveSearchResultIndex(0)
      setActiveSearchMessageId(firstMessageId)
      await jumpToMessageInSelectedRoom(firstMessageId)
    } catch (error) {
      setRoomSearchResults([])
      setRoomSearchTotal(0)
      setActiveSearchResultIndex(-1)
      setActiveSearchMessageId(null)
      toast.error(getErrorMessage(error))
    } finally {
      setRoomSearchLoading(false)
    }
  }, [api, getErrorMessage, jumpToMessageInSelectedRoom, roomSearchKeyword, selectedRoom])

  const moveSearchResult = useCallback(
    (direction: -1 | 1) => {
      if (roomSearchResults.length === 0) return
      const len = roomSearchResults.length
      const current = activeSearchResultIndex < 0 ? 0 : activeSearchResultIndex
      const next = (current + direction + len) % len
      const target = roomSearchResults[next]
      setActiveSearchResultIndex(next)
      setActiveSearchMessageId(target?.message_id ?? null)
      if (target?.message_id) {
        void jumpToMessageInSelectedRoom(target.message_id)
      }
    },
    [activeSearchResultIndex, jumpToMessageInSelectedRoom, roomSearchResults]
  )

  const handleGroupCreateButtonMouseEnter = useCallback(() => {
    if (groupCreateTooltipTimerRef.current) {
      window.clearTimeout(groupCreateTooltipTimerRef.current)
      groupCreateTooltipTimerRef.current = null
    }
    groupCreateTooltipTimerRef.current = window.setTimeout(() => {
      setShowGroupCreateTooltip(true)
      groupCreateTooltipTimerRef.current = null
    }, 500)
  }, [])

  const handleGroupCreateButtonMouseLeave = useCallback(() => {
    if (groupCreateTooltipTimerRef.current) {
      window.clearTimeout(groupCreateTooltipTimerRef.current)
      groupCreateTooltipTimerRef.current = null
    }
    setShowGroupCreateTooltip(false)
  }, [])

  const stopTypingSignal = useCallback(
    (roomId?: number | null) => {
      if (typingStopTimerRef.current) {
        window.clearTimeout(typingStopTimerRef.current)
        typingStopTimerRef.current = null
      }
      const targetRoomId = roomId ?? selectedRoomIdRef.current
      if (typingSentRef.current && targetRoomId) {
        sendWsEvent('chat.typing', { room_id: targetRoomId, is_typing: false })
      }
      typingSentRef.current = false
    },
    [sendWsEvent]
  )

  const handleSendMessage = useCallback(async () => {
    if (!selectedRoomId) return
    if (isMessageComposing) return
    const body = (roomMessageBodyMap[selectedRoomId] || '').trim()
    if (!body || sendInFlightRef.current) return
    sendInFlightRef.current = true
    try {
      setSending(true)
      const sentByWs = sendWsEvent('chat.send', {
        room_id: selectedRoomId,
        body,
      })
      setRoomMessageBodyMap((prev) => ({ ...prev, [selectedRoomId]: '' }))
      stopTypingSignal(selectedRoomId)
      if (!sentByWs) {
        await api.sendMessage(selectedRoomId, body)
        await Promise.all([loadMessages(selectedRoomId), loadRooms()])
      }
      requestAnimationFrame(() => {
        if (messageScrollRef.current) {
          messageScrollRef.current.scrollTop = messageScrollRef.current.scrollHeight
        }
      })
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      sendInFlightRef.current = false
      setSending(false)
    }
  }, [api, getErrorMessage, isMessageComposing, loadMessages, loadRooms, roomMessageBodyMap, selectedRoomId, sendWsEvent, stopTypingSignal])

  const handleSendMessageForRoom = useCallback(
    async (roomId: number) => {
      if (!roomId) return
      const body = (roomMessageBodyMap[roomId] || '').trim()
      if (!body || sendInFlightRef.current) return
      sendInFlightRef.current = true
      try {
        setRoomSendingMap((prev) => ({ ...prev, [roomId]: true }))
        const sentByWs = sendWsEvent('chat.send', {
          room_id: roomId,
          body,
        })
        setRoomMessageBodyMap((prev) => ({ ...prev, [roomId]: '' }))
        if (!sentByWs) {
          await api.sendMessage(roomId, body)
          await Promise.all([loadMessages(roomId, { silent: true }), loadRooms({ silent: true })])
        }
      } catch (error) {
        toast.error(getErrorMessage(error))
      } finally {
        sendInFlightRef.current = false
        setRoomSendingMap((prev) => ({ ...prev, [roomId]: false }))
      }
    },
    [api, getErrorMessage, loadMessages, loadRooms, roomMessageBodyMap, sendWsEvent]
  )

  const uploadAttachmentFile = useCallback(
    async (file: File) => {
      if (!selectedRoomId || !file) return
      try {
        setUploadingAttachment(true)
        const uploadedMessage = await api.uploadAttachment(selectedRoomId, file)
        if (!wsConnectedRef.current) {
          setMessages((prev) => {
            const map = new Map<number, WorkChatMessage>()
            prev.forEach((row) => map.set(row.id, row))
            map.set(uploadedMessage.id, uploadedMessage)
            return Array.from(map.values()).sort((a, b) => a.id - b.id)
          })
          void loadRooms({ silent: true })
        }
        requestAnimationFrame(() => {
          if (messageScrollRef.current) {
            messageScrollRef.current.scrollTop = messageScrollRef.current.scrollHeight
          }
        })
      } catch (error) {
        toast.error(getErrorMessage(error))
      } finally {
        setUploadingAttachment(false)
      }
    },
    [api, getErrorMessage, loadRooms, selectedRoomId]
  )

  const uploadAttachmentFileToRoom = useCallback(
    async (roomId: number, file: File) => {
      if (!roomId || !file) return
      try {
        setUploadingAttachment(true)
        const uploadedMessage = await api.uploadAttachment(roomId, file)
        if (!wsConnectedRef.current) {
          setRoomMessagesMap((prev) => {
            const base = prev[roomId] || []
            return {
              ...prev,
              [roomId]: mergeAndSortMessages(base, [uploadedMessage]),
            }
          })
          void loadRooms({ silent: true })
        }
      } catch (error) {
        toast.error(getErrorMessage(error))
      } finally {
        setUploadingAttachment(false)
      }
    },
    [api, getErrorMessage, loadRooms]
  )

  const ensureInlineAttachmentPreviewUrl = useCallback(
    async (attachmentId: number, force = false): Promise<string | null> => {
      if (!force) {
        const cachedUrl = getCachedInlineAttachmentUrl(attachmentId)
        if (cachedUrl) return cachedUrl
      }
      if (inlineAttachmentLoadingRef.current.has(attachmentId)) {
        return getCachedInlineAttachmentUrl(attachmentId)
      }
      inlineAttachmentLoadingRef.current.add(attachmentId)
      setInlineAttachmentLoadingIds((prev) => ({ ...prev, [attachmentId]: true }))
      try {
        const data = await api.getAttachmentPreviewUrl(attachmentId)
        if (!data?.url) return null
        const expiresInSec = Number(data.expires_in ?? 300)
        inlineAttachmentUrlRef.current[attachmentId] = {
          url: data.url,
          expiresAt: Date.now() + Math.max(30, expiresInSec - 10) * 1000,
        }
        return data.url
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 410 && selectedRoomId) {
          toast.error('만료된 파일입니다.')
          void loadMessages(selectedRoomId)
          return null
        }
        toast.error(getErrorMessage(error))
        return null
      } finally {
        inlineAttachmentLoadingRef.current.delete(attachmentId)
        setInlineAttachmentLoadingIds((prev) => {
          if (!prev[attachmentId]) return prev
          const next = { ...prev }
          delete next[attachmentId]
          return next
        })
      }
    },
    [api, getCachedInlineAttachmentUrl, getErrorMessage, loadMessages, selectedRoomId]
  )

  const handlePreviewAttachment = useCallback(
    async (attachmentId: number) => {
      try {
        const url = await ensureInlineAttachmentPreviewUrl(attachmentId, true)
        if (!url) return
        window.open(url, '_blank', 'noopener,noreferrer')
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 410 && selectedRoomId) {
          toast.error('만료된 파일입니다.')
          void loadMessages(selectedRoomId)
          return
        }
        toast.error(getErrorMessage(error))
      }
    },
    [ensureInlineAttachmentPreviewUrl, getErrorMessage, loadMessages, selectedRoomId]
  )

  const handleOpenImageViewer = useCallback(
    async (attachmentId: number, fileName: string) => {
      const url = await ensureInlineAttachmentPreviewUrl(attachmentId)
      if (!url) return
      setImageViewer({ url, fileName })
      setImageViewerMode('fit')
      setImageViewerExpanded(true)
    },
    [ensureInlineAttachmentPreviewUrl]
  )

  const handleInlineAttachmentImageError = useCallback(
    async (attachmentId: number) => {
      if (!attachmentId) return
      if (inlineAttachmentRetryRef.current.has(attachmentId)) {
        return
      }
      inlineAttachmentRetryRef.current.add(attachmentId)
      const releaseRetryLock = () => {
        window.setTimeout(() => {
          inlineAttachmentRetryRef.current.delete(attachmentId)
        }, 1200)
      }
      const refreshed = await ensureInlineAttachmentPreviewUrl(attachmentId, true)
      if (refreshed) {
        releaseRetryLock()
        return
      }
      try {
        const fallback = await api.getAttachmentDownloadUrl(attachmentId)
        if (fallback?.url) {
          const expiresInSec = Number(fallback.expires_in ?? 300)
          inlineAttachmentUrlRef.current[attachmentId] = {
            url: fallback.url,
            expiresAt: Date.now() + Math.max(30, expiresInSec - 10) * 1000,
          }
          releaseRetryLock()
          return
        }
      } catch {
        // ignore and keep placeholder UI
      } finally {
        releaseRetryLock()
      }
    },
    [api, ensureInlineAttachmentPreviewUrl]
  )

  const handleDownloadAttachment = useCallback(
    async (attachmentId: number) => {
      try {
        const data = await api.getAttachmentDownloadUrl(attachmentId)
        if (!data?.url) return
        window.location.href = data.url
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 410 && selectedRoomId) {
          toast.error('만료된 파일입니다.')
          void loadMessages(selectedRoomId)
          return
        }
        toast.error(getErrorMessage(error))
      }
    },
    [api, getErrorMessage, loadMessages, selectedRoomId]
  )

  const handleOpenSaveCompanyPanel = useCallback(
    (attachmentId: number, fileName: string) => {
      if (!canSaveToCompany) return
      setSaveTargetAttachment({ attachmentId, fileName })
      setSelectedCompanyId(null)
      setSaveDocumentTitle(fileName)
      setCompanySearchKeyword('')
      setShowSaveCompanyPanel(true)
    },
    [canSaveToCompany]
  )

  const handleSaveAttachmentToCompany = useCallback(async () => {
    if (!saveTargetAttachment || !selectedCompanyId) return
    try {
      setSavingAttachmentId(saveTargetAttachment.attachmentId)
      const res = await api.saveAttachmentToCompany(saveTargetAttachment.attachmentId, {
        company_id: selectedCompanyId,
        title: saveDocumentTitle.trim() || undefined,
      })
      toast.success(res.message || '고객사 기타문서로 저장했습니다.')
      setShowSaveCompanyPanel(false)
      setSaveTargetAttachment(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSavingAttachmentId(null)
    }
  }, [api, getErrorMessage, saveDocumentTitle, saveTargetAttachment, selectedCompanyId])

  const handleDeleteMessage = useCallback(
    async (messageId: number) => {
      if (!selectedRoomId) return
      try {
        await api.deleteMessage(messageId)
        await loadMessages(selectedRoomId)
      } catch (error) {
        toast.error(getErrorMessage(error))
      }
    },
    [api, getErrorMessage, loadMessages, selectedRoomId]
  )

  const openMessageContextMenu = useCallback(
    (event: React.MouseEvent, messageId: number) => {
      event.preventDefault()
      event.stopPropagation()
      const menuWidth = 132
      const menuHeight = 44
      const viewportPadding = 8
      const x = Math.min(event.clientX, window.innerWidth - menuWidth - viewportPadding)
      const y = Math.min(event.clientY, window.innerHeight - menuHeight - viewportPadding)
      setMessageContextMenu({
        messageId,
        x: Math.max(viewportPadding, x),
        y: Math.max(viewportPadding, y),
      })
    },
    []
  )

  const openRoomContextMenu = useCallback(
    (event: React.MouseEvent, roomId: number) => {
      event.preventDefault()
      event.stopPropagation()
      const menuWidth = 156
      const menuHeight = 82
      const viewportPadding = 8
      const x = Math.min(event.clientX, window.innerWidth - menuWidth - viewportPadding)
      const y = Math.min(event.clientY, window.innerHeight - menuHeight - viewportPadding)
      setRoomContextMenu({
        roomId,
        x: Math.max(viewportPadding, x),
        y: Math.max(viewportPadding, y),
      })
      setMessageContextMenu(null)
    },
    []
  )

  const handleMessageBodyChange = useCallback(
    (value: string) => {
      const roomId = selectedRoomIdRef.current
      if (!roomId) return
      setRoomMessageBodyMap((prev) => ({ ...prev, [roomId]: value }))
      if (!wsConnectedRef.current) return

      const hasText = value.trim().length > 0
      if (!hasText) {
        stopTypingSignal(roomId)
        return
      }

      if (!typingSentRef.current) {
        sendWsEvent('chat.typing', { room_id: roomId, is_typing: true })
        typingSentRef.current = true
      }

      if (typingStopTimerRef.current) {
        window.clearTimeout(typingStopTimerRef.current)
      }
      typingStopTimerRef.current = window.setTimeout(() => {
        stopTypingSignal(roomId)
      }, TYPING_AUTO_CLEAR_MS)
    },
    [sendWsEvent, stopTypingSignal]
  )

  useEffect(() => {
    if (!open) return
    const width = Math.min(LAUNCHER_DEFAULT_WIDTH, window.innerWidth - 24)
    const height = Math.min(LAUNCHER_DEFAULT_HEIGHT, window.innerHeight - 24)
    setLauncherSize({ width, height })

    let nextPosition = { x: 24, y: 24 }
    const rawSaved = window.localStorage.getItem(storagePositionKey)
    if (rawSaved) {
      try {
        const saved = JSON.parse(rawSaved) as { x: number; y: number }
        nextPosition = clampPosition(saved.x, saved.y, width, height)
      } catch {
        nextPosition = clampPosition(window.innerWidth - width - 24, window.innerHeight - height - 24, width, height)
      }
    } else {
      nextPosition = clampPosition(window.innerWidth - width - 24, window.innerHeight - height - 24, width, height)
    }
    setPosition(nextPosition)
    setPositionReady(true)
  }, [open, storagePositionKey, clampPosition])

  useEffect(() => {
    if (!chatWindowOpen) return
    const width = Math.min(CHAT_WINDOW_DEFAULT_WIDTH, window.innerWidth - 24)
    const height = Math.min(CHAT_WINDOW_DEFAULT_HEIGHT, window.innerHeight - 24)
    setChatWindowSize({ width, height })

    let nextPosition = { x: 24, y: 24 }
    const rawSaved = window.localStorage.getItem(chatWindowStoragePositionKey)
    if (rawSaved) {
      try {
        const saved = JSON.parse(rawSaved) as { x: number; y: number }
        nextPosition = clampPosition(saved.x, saved.y, width, height)
      } catch {
        nextPosition = clampPosition(window.innerWidth - width - 24, window.innerHeight - height - 24, width, height)
      }
    } else {
      nextPosition = clampPosition(window.innerWidth - width - 24, Math.max(16, window.innerHeight - height - 90), width, height)
    }
    setChatWindowPosition(nextPosition)
    setChatWindowPositionReady(true)
  }, [chatWindowOpen, chatWindowStoragePositionKey, clampPosition])

  useEffect(() => {
    if (!open && !chatWindowOpen) return
    const onResize = () => {
      if (open) {
        const width = Math.min(LAUNCHER_DEFAULT_WIDTH, window.innerWidth - 24)
        const height = Math.min(LAUNCHER_DEFAULT_HEIGHT, window.innerHeight - 24)
        setLauncherSize({ width, height })
        setPosition((prev) => clampPosition(prev.x, prev.y, width, height))
      }
      if (chatWindowOpen) {
        const width = Math.min(CHAT_WINDOW_DEFAULT_WIDTH, window.innerWidth - 24)
        const height = Math.min(CHAT_WINDOW_DEFAULT_HEIGHT, window.innerHeight - 24)
        setChatWindowSize({ width, height })
        setChatWindowPosition((prev) => clampPosition(prev.x, prev.y, width, height))
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open, chatWindowOpen, clampPosition])

  useEffect(() => {
    if (!open) return
    if (!firstOpenedRef.current) {
      firstOpenedRef.current = true
      void Promise.all([loadRooms(), loadParticipants()])
      return
    }
    void loadRooms()
  }, [open, loadRooms, loadParticipants])

  useEffect(() => {
    if (!open) return
    void loadParticipants({ silent: true })
    const timer = window.setInterval(() => {
      void loadParticipants({ silent: true })
    }, 20_000)
    return () => window.clearInterval(timer)
  }, [open, loadParticipants])

  useEffect(() => {
    const handleProfileImageUpdated = () => {
      void loadParticipants({ silent: true })
      if (open) {
        void loadRooms({ silent: true })
      }
    }
    window.addEventListener(PROFILE_IMAGE_UPDATED_EVENT, handleProfileImageUpdated)
    return () => window.removeEventListener(PROFILE_IMAGE_UPDATED_EVENT, handleProfileImageUpdated)
  }, [loadParticipants, loadRooms, open])

  useEffect(() => {
    if (open) {
      wsAuthBlockedRef.current = false
      wsAuthToastShownRef.current = null
    }
  }, [open])

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId
  }, [selectedRoomId])

  useEffect(() => {
    openedRoomIdsRef.current = openedRoomIds
  }, [openedRoomIds])

  useEffect(() => {
    if (!chatWindowOpen) {
      if (openedRoomIds.length === 0) {
        setActiveWindowRoomId(null)
      }
      return
    }
    if (activeWindowRoomId == null && selectedRoomId) {
      setActiveWindowRoomId(selectedRoomId)
      return
    }
    if (
      activeWindowRoomId != null &&
      activeWindowRoomId !== selectedRoomId &&
      !openedRoomIds.includes(activeWindowRoomId)
    ) {
      setActiveWindowRoomId(selectedRoomId ?? null)
    }
  }, [activeWindowRoomId, chatWindowOpen, openedRoomIds, selectedRoomId])

  useEffect(() => {
    if (!chatWindowOpen) return
    const secondaryRooms = openedRooms.filter((room) => room.id !== selectedRoomId)
    if (secondaryRooms.length === 0) return

    setSecondaryWindowPositions((prev) => {
      let next = prev
      secondaryRooms.forEach((room, index) => {
        if (next[room.id]) return
        if (next === prev) next = { ...prev }
        const width = CHAT_WINDOW_DEFAULT_WIDTH
        const height = CHAT_WINDOW_DEFAULT_HEIGHT
        const rawX = window.innerWidth - width - 24 - index * (width + 12)
        const rawY = window.innerHeight - height - 24
        next[room.id] = clampSecondaryPosition(rawX, rawY, width, height)
      })
      return next
    })

    setSecondaryWindowSizes((prev) => {
      let next = prev
      secondaryRooms.forEach((room) => {
        if (next[room.id]) return
        if (next === prev) next = { ...prev }
        next[room.id] = {
          width: CHAT_WINDOW_DEFAULT_WIDTH,
          height: CHAT_WINDOW_DEFAULT_HEIGHT,
        }
      })
      return next
    })
  }, [chatWindowOpen, clampSecondaryPosition, openedRooms, selectedRoomId])

  useEffect(() => {
    wsConnectedRef.current = wsConnected
  }, [wsConnected])

  useEffect(() => {
    if (!wsConnected) {
      const roomPolling = window.setInterval(() => {
        void loadRooms({ silent: true })
      }, 10000)
      return () => window.clearInterval(roomPolling)
    }
  }, [wsConnected, loadRooms])

  useEffect(() => {
    if (!chatWindowOpen || !selectedRoomId) return
    if (!wsConnected) {
      const messagePolling = window.setInterval(() => {
        void loadMessages(selectedRoomId, { silent: true })
      }, 5000)
      return () => window.clearInterval(messagePolling)
    }
  }, [chatWindowOpen, selectedRoomId, wsConnected, loadMessages])

  useEffect(() => {
    if (wsConnected) return
    const token = portalType === 'admin' ? getAdminAccessToken() : getClientAccessToken()
    if (!token) return

    void loadRooms({ silent: true })
    const closedPolling = window.setInterval(() => {
      void loadRooms({ silent: true })
    }, 12000)
    return () => window.clearInterval(closedPolling)
  }, [portalType, wsConnected, loadRooms])

  useEffect(() => {
    const clearTypingTimers = () => {
      typingExpiryTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
      typingExpiryTimersRef.current.clear()
    }
    return () => {
      clearTypingTimers()
      if (typingStopTimerRef.current) {
        window.clearTimeout(typingStopTimerRef.current)
        typingStopTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    let disposed = false

    const clearReconnectTimer = () => {
      if (wsReconnectTimerRef.current) {
        window.clearTimeout(wsReconnectTimerRef.current)
        wsReconnectTimerRef.current = null
      }
    }

    const clearPingTimer = () => {
      if (wsPingTimerRef.current) {
        window.clearInterval(wsPingTimerRef.current)
        wsPingTimerRef.current = null
      }
    }

    const clearSocket = () => {
      const ws = wsRef.current
      if (!ws) return
      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      ws.close()
      wsRef.current = null
    }

    const scheduleReconnect = () => {
      if (disposed || wsReconnectTimerRef.current) return
      const delay = wsReconnectDelayRef.current
      wsReconnectTimerRef.current = window.setTimeout(() => {
        wsReconnectTimerRef.current = null
        wsReconnectDelayRef.current = Math.min(wsReconnectDelayRef.current * 2, WS_RECONNECT_MAX_MS)
        connect()
      }, delay)
    }

    const handlePresenceRows = (rows: any[]) => {
      if (!Array.isArray(rows) || rows.length === 0) return
      setPresenceMap((prev) => {
        const next = { ...prev }
        rows.forEach((row) => {
          const memberType = extractWsMemberType(row)
          const memberId = extractWsMemberId(row)
          if (!memberType || memberId <= 0) return
          const actorKey = toActorKey(memberType, memberId)
          next[actorKey] = {
            online: Boolean(row?.online),
            inRoom: Boolean(row?.in_room),
            roomId: toNumber(row?.room_id ?? row?.roomId, 0) || null,
          }
        })
        return next
      })
    }

    const connect = () => {
      if (disposed) return
      const latestToken = portalType === 'admin' ? getAdminAccessToken() : getClientAccessToken()
      if (!latestToken) {
        setWsConnected(false)
        setWsConnecting(false)
        setWsCloseInfo({ code: 4401, reason: 'token_missing' })
        return
      }
      const wsUrl = buildWsUrl(portalType, latestToken)
      if (!wsUrl) return

      setWsCloseInfo(null)
      setWsConnecting(true)
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws
      subscribedRoomIdsRef.current = new Set()

      ws.onopen = () => {
        if (disposed) return
        wsReconnectDelayRef.current = 1000
        clearPingTimer()
        wsPingTimerRef.current = window.setInterval(() => {
          sendWsEvent('chat.ping', {})
        }, 25000)
      }

      ws.onmessage = (event) => {
        if (disposed) return
        let payload: any = null
        try {
          payload = JSON.parse(event.data)
        } catch {
          return
        }

        const eventName = normalizeWsEventName(payload?.event ?? payload?.type)
        const data = payload?.data ?? payload?.payload ?? {}
        if (!eventName) return

        if (eventName === 'chat.ws.ready') {
          setWsConnected(true)
          setWsConnecting(false)
          setWsCloseInfo(null)
          wsAuthBlockedRef.current = false
          wsAuthToastShownRef.current = null
          void loadRooms({ silent: true })
          return
        }
        if (eventName === 'chat.pong') {
          return
        }
        if (eventName === 'chat.error') {
          const detail = typeof data?.detail === 'string' ? data.detail : typeof data?.message === 'string' ? data.message : '채팅 처리 중 오류가 발생했습니다.'
          toast.error(detail)
          return
        }
        if (eventName === 'chat.subscribed') {
          const roomId = toNumber(data?.room_id ?? data?.roomId)
          if (roomId > 0) {
            subscribedRoomIdsRef.current.add(roomId)
          }
          const snapshotRows = Array.isArray(data?.presence_snapshot)
            ? data.presence_snapshot
            : Array.isArray(data?.presence)
              ? data.presence
              : []
          handlePresenceRows(snapshotRows)
          return
        }
        if (eventName === 'chat.presence') {
          handlePresenceRows([data])
          return
        }
        if (eventName === 'chat.typing') {
          const roomId = toNumber(data?.room_id ?? data?.roomId)
          const memberType = extractWsMemberType(data)
          const memberId = extractWsMemberId(data)
          if (!roomId || !memberType || memberId <= 0) return
          if (memberType === actor.type && memberId === actor.id) return

          const actorKey = toActorKey(memberType, memberId)
          const isTyping = Boolean(data?.is_typing)
          const existingTimer = typingExpiryTimersRef.current.get(actorKey)
          if (existingTimer) {
            window.clearTimeout(existingTimer)
            typingExpiryTimersRef.current.delete(actorKey)
          }

          if (!isTyping) {
            setTypingMap((prev) => {
              if (!prev[actorKey]) return prev
              const next = { ...prev }
              delete next[actorKey]
              return next
            })
            return
          }

          const resolvedName =
            typeof data?.name === 'string' && data.name.trim()
              ? data.name
              : participantNameMapRef.current.get(actorKey) || `사용자#${memberId}`
          setTypingMap((prev) => ({
            ...prev,
            [actorKey]: {
              roomId,
              name: resolvedName,
            },
          }))
          const timerId = window.setTimeout(() => {
            setTypingMap((prev) => {
              if (!prev[actorKey]) return prev
              const next = { ...prev }
              delete next[actorKey]
              return next
            })
            typingExpiryTimersRef.current.delete(actorKey)
          }, TYPING_AUTO_CLEAR_MS)
          typingExpiryTimersRef.current.set(actorKey, timerId)
          return
        }
        if (eventName === 'chat.read' || eventName === 'chat.read.ack') {
          const roomId = toNumber(data?.room_id ?? data?.roomId)
          if (roomId <= 0) return
          const memberType = extractWsMemberType(data)
          const memberId = extractWsMemberId(data)
          const lastReadMessageId = toNumber(
            data?.last_read_message_id ?? data?.lastReadMessageId,
            0
          )
          if (memberType && memberId > 0) {
            mergeRoomReadCursor(roomId, {
              member_type: memberType,
              member_id: memberId,
              last_read_message_id: lastReadMessageId || null,
            })
          }
          const isMe = memberType === actor.type && memberId === actor.id
          setRooms((prev) =>
            prev.map((room) => {
              if (room.id !== roomId) return room
              const unreadCount = isMe
                ? 0
                : data?.unread_count == null
                  ? room.unread_count
                  : Math.max(0, toNumber(data.unread_count, room.unread_count))
              return {
                ...room,
                unread_count: unreadCount,
                unread_count_display: toUnreadCountDisplay(unreadCount),
              }
            })
          )
          return
        }
        if (eventName === 'chat.room.new') {
          const patch = normalizeWsRoomPatch(data)
          if (patch) {
            if (patch.is_active === false) {
              return
            }
            if (!includeHiddenRooms && patch.is_hidden) {
              return
            }
            setRooms((prev) => {
              if (prev.some((room) => room.id === patch.id)) {
                return prev
              }
              const unreadCount = Math.max(0, patch.unread_count ?? 0)
              const next = [
                {
                  id: patch.id,
                  room_type: patch.room_type || 'direct',
                  is_active: patch.is_active ?? true,
                  name: patch.name || null,
                  display_name: patch.display_name || patch.name || null,
                  is_hidden: Boolean(patch.is_hidden),
                  is_muted: Boolean(patch.is_muted),
                  muted_until: patch.muted_until || null,
                  unread_count: unreadCount,
                  unread_count_display: patch.unread_count_display || toUnreadCountDisplay(unreadCount),
                  last_message_preview: patch.last_message_preview || null,
                  last_message_id: patch.last_message_id ?? null,
                  last_message_at: patch.last_message_at || null,
                },
                ...prev,
              ]
              return sortRoomsByRecentMessage(next)
            })
            return
          }
          void loadRooms({ silent: true })
          return
        }
        if (eventName === 'chat.room.bump') {
          const patch = normalizeWsRoomPatch(data)
          if (!patch) {
            void loadRooms({ silent: true })
            return
          }
          if (patch.is_active === false) {
            setRooms((prev) => prev.filter((room) => room.id !== patch.id))
            setOpenedRoomIds((prev) => prev.filter((id) => id !== patch.id))
            setActiveWindowRoomId((prev) => (prev === patch.id ? null : prev))
            setSecondaryWindowPositions((prev) => {
              const next = { ...prev }
              delete next[patch.id]
              return next
            })
            setSecondaryWindowSizes((prev) => {
              const next = { ...prev }
              delete next[patch.id]
              return next
            })
            if (selectedRoomIdRef.current === patch.id) {
              closeChatWindow()
              setActiveTab('rooms')
            }
            return
          }
          if (!includeHiddenRooms && patch.is_hidden) {
            setRooms((prev) => prev.filter((room) => room.id !== patch.id))
            setOpenedRoomIds((prev) => prev.filter((id) => id !== patch.id))
            setActiveWindowRoomId((prev) => (prev === patch.id ? null : prev))
            setSecondaryWindowPositions((prev) => {
              const next = { ...prev }
              delete next[patch.id]
              return next
            })
            setSecondaryWindowSizes((prev) => {
              const next = { ...prev }
              delete next[patch.id]
              return next
            })
            return
          }
          setRooms((prev) => {
            const next = [...prev]
            const idx = next.findIndex((room) => room.id === patch.id)
            if (idx >= 0) {
              const base = next[idx]
              const unreadCount =
                patch.unread_count == null ? base.unread_count : Math.max(0, patch.unread_count)
              next[idx] = {
                ...base,
                ...(patch.room_type !== undefined ? { room_type: patch.room_type } : {}),
                ...(patch.is_active !== undefined ? { is_active: patch.is_active } : {}),
                ...(patch.name !== undefined ? { name: patch.name } : {}),
                ...(patch.display_name !== undefined ? { display_name: patch.display_name } : {}),
                ...(patch.is_hidden !== undefined ? { is_hidden: patch.is_hidden } : {}),
                ...(patch.is_muted !== undefined ? { is_muted: patch.is_muted } : {}),
                ...(patch.muted_until !== undefined ? { muted_until: patch.muted_until } : {}),
                ...(patch.last_message_preview !== undefined ? { last_message_preview: patch.last_message_preview } : {}),
                ...(patch.last_message_id !== undefined ? { last_message_id: patch.last_message_id } : {}),
                ...(patch.last_message_at !== undefined ? { last_message_at: patch.last_message_at } : {}),
                unread_count: unreadCount,
                unread_count_display:
                  patch.unread_count_display || toUnreadCountDisplay(unreadCount),
              }
            } else {
              const unreadCount = Math.max(0, patch.unread_count ?? 0)
              next.push({
                id: patch.id,
                room_type: patch.room_type || 'direct',
                is_active: patch.is_active ?? true,
                name: patch.name || null,
                display_name: patch.display_name || patch.name || null,
                is_hidden: Boolean(patch.is_hidden),
                is_muted: Boolean(patch.is_muted),
                muted_until: patch.muted_until || null,
                unread_count: unreadCount,
                unread_count_display: patch.unread_count_display || toUnreadCountDisplay(unreadCount),
                last_message_preview: patch.last_message_preview || null,
                last_message_id: patch.last_message_id ?? null,
                last_message_at: patch.last_message_at || null,
              })
            }
            return sortRoomsByRecentMessage(next)
          })
          return
        }
        if (eventName === 'chat.message') {
          const message = normalizeIncomingMessage(data?.message ?? data)
          if (!message) return

          const memberType = extractWsMemberType(data)
          const memberId = extractWsMemberId(data)
          const senderType = memberType || message.sender_type
          const senderId = memberId > 0 ? memberId : toNumber(message.sender_id, 0)
          const isMine = senderType === actor.type && senderId === actor.id
          const roomId = message.room_id
          const isViewingRoom = selectedRoomIdRef.current === roomId
          const isOpenedRoom = openedRoomIdsRef.current.includes(roomId)
          const shouldScroll = isViewingRoom && isAtBottom(messageScrollRef.current)

          if (isViewingRoom) {
            setMessages((prev) => {
              return mergeAndSortMessages(prev, [message])
            })
          }
          if (isOpenedRoom) {
            setRoomMessagesMap((prev) => {
              const base = prev[roomId] || []
              return {
                ...prev,
                [roomId]: mergeAndSortMessages(base, [message]),
              }
            })
          }

          setRooms((prev) => {
            const next = [...prev]
            const idx = next.findIndex((room) => room.id === roomId)
            if (idx >= 0) {
              const current = next[idx]
              let unreadCount = current.unread_count
              if (isViewingRoom || isMine) unreadCount = 0
              else unreadCount = Math.max(0, unreadCount + 1)
              next[idx] = {
                ...current,
                last_message_preview: message.is_deleted
                  ? '삭제된 메시지입니다.'
                  : message.body || current.last_message_preview,
                last_message_id: message.id,
                last_message_at: message.created_at,
                unread_count: unreadCount,
                unread_count_display: toUnreadCountDisplay(unreadCount),
              }
            } else {
              const unreadCount = isViewingRoom || isMine ? 0 : 1
              next.push({
                id: roomId,
                room_type: 'direct',
                name: null,
                display_name: null,
                is_hidden: false,
                is_muted: false,
                muted_until: null,
                unread_count: unreadCount,
                unread_count_display: toUnreadCountDisplay(unreadCount),
                last_message_preview: message.is_deleted ? '삭제된 메시지입니다.' : message.body,
                last_message_id: message.id,
                last_message_at: message.created_at,
              })
              void loadRooms({ silent: true })
            }
            return sortRoomsByRecentMessage(next)
          })

          if (isViewingRoom) {
            if (!isMine) {
              void markRoomRead(roomId, message.id)
            }
            if (shouldScroll) {
              requestAnimationFrame(() => {
                if (messageScrollRef.current) {
                  messageScrollRef.current.scrollTop = messageScrollRef.current.scrollHeight
                }
              })
            }
          }
          return
        }
      }

      ws.onerror = (errorEvent) => {
        if (disposed) return
        console.warn('[work-chat] websocket error', {
          portalType,
          readyState: ws.readyState,
          event: errorEvent?.type || 'error',
        })
      }

      ws.onclose = (closeEvent) => {
        if (disposed) return
        const code = Number(closeEvent.code || 0)
        const reason = String(closeEvent.reason || '').trim()
        setWsCloseInfo({ code, reason })
        console.warn('[work-chat] websocket closed', { portalType, code, reason })

        setWsConnected(false)
        clearPingTimer()
        subscribedRoomIdsRef.current = new Set()
        enteredRoomIdRef.current = null

        if (code === 4401 || code === 4403) {
          wsAuthBlockedRef.current = true
          setWsConnecting(false)
          if (wsAuthToastShownRef.current !== code) {
            toast.error(
              code === 4401
                ? '채팅 인증이 만료되었습니다. 다시 로그인해 주세요.'
                : '채팅 접근 권한이 없습니다.'
            )
            wsAuthToastShownRef.current = code
          }
          return
        }

        if (wsAuthBlockedRef.current) {
          setWsConnecting(false)
          return
        }
        setWsConnecting(true)
        scheduleReconnect()
      }
    }

    connect()

    return () => {
      disposed = true
      clearReconnectTimer()
      clearPingTimer()
      setWsConnected(false)
      setWsConnecting(false)
      setWsCloseInfo(null)
      wsAuthBlockedRef.current = false
      wsAuthToastShownRef.current = null
      subscribedRoomIdsRef.current = new Set()
      enteredRoomIdRef.current = null
      clearSocket()
    }
  }, [actor.id, actor.type, closeChatWindow, includeHiddenRooms, loadRooms, markRoomRead, mergeRoomReadCursor, portalType, sendWsEvent])

  useEffect(() => {
    if (!wsConnected || rooms.length === 0) return
    const currentRoomIds = new Set(rooms.map((room) => room.id))
    currentRoomIds.forEach((roomId) => {
      if (subscribedRoomIdsRef.current.has(roomId)) return
      if (sendWsEvent('chat.subscribe', { room_id: roomId })) {
        subscribedRoomIdsRef.current.add(roomId)
      }
    })
    Array.from(subscribedRoomIdsRef.current).forEach((roomId) => {
      if (currentRoomIds.has(roomId)) return
      sendWsEvent('chat.unsubscribe', { room_id: roomId })
      subscribedRoomIdsRef.current.delete(roomId)
    })
  }, [rooms, sendWsEvent, wsConnected])

  useEffect(() => {
    if (!wsConnected) return
    const previousRoomId = enteredRoomIdRef.current
    if (previousRoomId && previousRoomId !== selectedRoomId) {
      sendWsEvent('chat.leave_room_view', { room_id: previousRoomId })
    }
    if (chatWindowOpen && selectedRoomId) {
      sendWsEvent('chat.enter_room', { room_id: selectedRoomId })
    } else if (previousRoomId) {
      sendWsEvent('chat.leave_room_view', { room_id: previousRoomId })
    }
    enteredRoomIdRef.current = chatWindowOpen ? selectedRoomId : null
  }, [chatWindowOpen, selectedRoomId, sendWsEvent, wsConnected])

  useEffect(() => {
    if (!chatWindowOpen || !selectedRoomId) {
      stopTypingSignal()
    }
  }, [chatWindowOpen, selectedRoomId, stopTypingSignal])

  useEffect(() => {
    if (!chatWindowOpen || messages.length === 0) return
    const targets = messages
      .filter((message) => {
        if (!message.attachment || message.is_deleted) return false
        if (message.attachment.is_expired || message.body === '만료된 파일입니다.') return false
        const kind = message.attachment.kind ?? (message.message_type === 'image' ? 'image' : 'file')
        return kind === 'image'
      })
      .map((message) => message.attachment!.id)
    if (targets.length === 0) return
    targets.forEach((attachmentId) => {
      const cached = inlineAttachmentUrlRef.current[attachmentId]
      if (cached && cached.expiresAt > Date.now() + 15_000) return
      void ensureInlineAttachmentPreviewUrl(attachmentId)
    })
  }, [chatWindowOpen, ensureInlineAttachmentPreviewUrl, messages])

  useEffect(() => {
    if (!showSaveCompanyPanel) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        setCompanyOptionsLoading(true)
        const keyword = companySearchKeyword.trim() || undefined
        const response =
          portalType === 'admin'
            ? await fetchCompanyTaxList({ page: 1, limit: 100, keyword })
            : await fetchClientCompanyTaxList({ page: 1, limit: 100, keyword })
        if (!cancelled) {
          setCompanyOptions(response.items || [])
        }
      } catch {
        if (!cancelled) setCompanyOptions([])
      } finally {
        if (!cancelled) setCompanyOptionsLoading(false)
      }
    }, 220)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [companySearchKeyword, portalType, showSaveCompanyPanel])

  useEffect(() => {
    setRoomActionMenuOpen(false)
    setShowRoomMembersPanel(false)
    setRoomContextMenu(null)
    setMessageContextMenu(null)
    setShowRoomSearchPanel(false)
    setRoomSearchKeyword('')
    setRoomSearchResults([])
    setRoomSearchTotal(0)
    setActiveSearchResultIndex(-1)
    setActiveSearchMessageId(null)
    setJumpHighlightMessageId(null)
    setIsMessageComposing(false)
  }, [selectedRoomId])

  useEffect(() => {
    if (!chatWindowOpen || !selectedRoomId) return
    void loadReadCursors(selectedRoomId)
  }, [chatWindowOpen, loadReadCursors, selectedRoomId])

  useEffect(() => {
    nextBeforeMessageIdRef.current = nextBeforeMessageId
  }, [nextBeforeMessageId])

  useEffect(() => {
    if (!roomActionMenuOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (!roomActionMenuRef.current) return
      if (roomActionMenuRef.current.contains(event.target as Node)) return
      setRoomActionMenuOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [roomActionMenuOpen])

  useEffect(() => {
    if (!messageContextMenu) return
    const onPointerDown = (event: MouseEvent) => {
      if (!messageContextMenuRef.current) return
      if (messageContextMenuRef.current.contains(event.target as Node)) return
      setMessageContextMenu(null)
    }
    const closeMenu = () => setMessageContextMenu(null)
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('resize', closeMenu)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('resize', closeMenu)
    }
  }, [messageContextMenu])

  useEffect(() => {
    if (!roomContextMenu) return
    const onPointerDown = (event: MouseEvent) => {
      if (!roomContextMenuRef.current) return
      if (roomContextMenuRef.current.contains(event.target as Node)) return
      setRoomContextMenu(null)
    }
    const closeMenu = () => setRoomContextMenu(null)
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('resize', closeMenu)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('resize', closeMenu)
    }
  }, [roomContextMenu])

  useEffect(() => {
    return () => {
      if (groupCreateTooltipTimerRef.current) {
        window.clearTimeout(groupCreateTooltipTimerRef.current)
        groupCreateTooltipTimerRef.current = null
      }
      if (jumpHighlightTimerRef.current) {
        window.clearTimeout(jumpHighlightTimerRef.current)
        jumpHighlightTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!showGroupCreateModal) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      handleCloseGroupCreateModal()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleCloseGroupCreateModal, showGroupCreateModal])

  useEffect(() => {
    if (!chatWindowOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (roomContextMenu) {
        setRoomContextMenu(null)
        return
      }
      if (messageContextMenu) {
        setMessageContextMenu(null)
        return
      }
      if (imageViewer) {
        setImageViewer(null)
        return
      }
      if (showSaveCompanyPanel) {
        setShowSaveCompanyPanel(false)
        return
      }
      if (showRoomSearchPanel) {
        setShowRoomSearchPanel(false)
        return
      }
      closeChatWindow()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [chatWindowOpen, closeChatWindow, imageViewer, messageContextMenu, roomContextMenu, showRoomSearchPanel, showSaveCompanyPanel])

  useEffect(() => {
    if (!open) return
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return

      const clickedLauncher = launcherRef.current?.contains(target)
      if (clickedLauncher) return

      const clickedMainChatWindow = chatWindowRef.current?.contains(target)
      if (clickedMainChatWindow) return

      const clickedSecondaryChatWindow = Object.values(secondaryWindowRefs.current).some((node) =>
        node?.contains(target)
      )
      if (clickedSecondaryChatWindow) return

      setOpen(false)
      setRoomContextMenu(null)
      setMessageContextMenu(null)
    }

    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  const handleDragMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    setRoomContextMenu(null)
    setMessageContextMenu(null)
    if (event.button !== 0) return
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    }
    event.preventDefault()
  }

  const getSecondaryWindowDefaultPosition = useCallback((index: number) => {
    const width = CHAT_WINDOW_DEFAULT_WIDTH
    const height = CHAT_WINDOW_DEFAULT_HEIGHT
    const rawX = window.innerWidth - width - 24 - index * (width + 12)
    const rawY = window.innerHeight - height - 24
    return clampSecondaryPosition(rawX, rawY, width, height)
  }, [clampSecondaryPosition])

  const getSecondaryWindowSize = useCallback(
    (roomId: number) =>
      secondaryWindowSizes[roomId] || {
        width: CHAT_WINDOW_DEFAULT_WIDTH,
        height: CHAT_WINDOW_DEFAULT_HEIGHT,
      },
    [secondaryWindowSizes]
  )

  const handleSecondaryWindowDragMouseDown = useCallback(
    (roomId: number, index: number, event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      const defaultPos = getSecondaryWindowDefaultPosition(index)
      const currentPos = secondaryWindowPositions[roomId] || defaultPos
      const currentSize = getSecondaryWindowSize(roomId)
      secondaryWindowDragStateRef.current = {
        roomId,
        startX: event.clientX,
        startY: event.clientY,
        originX: clampSecondaryPosition(currentPos.x, currentPos.y, currentSize.width, currentSize.height).x,
        originY: clampSecondaryPosition(currentPos.x, currentPos.y, currentSize.width, currentSize.height).y,
      }
      event.preventDefault()
    },
    [clampSecondaryPosition, getSecondaryWindowDefaultPosition, getSecondaryWindowSize, secondaryWindowPositions]
  )

  const handleSecondaryWindowResizeMouseDown = useCallback(
    (
      roomId: number,
      index: number,
      mode: 'left' | 'right' | 'bottom' | 'corner',
      event: React.MouseEvent<HTMLDivElement>
    ) => {
      if (event.button !== 0) return
      const defaultPos = getSecondaryWindowDefaultPosition(index)
      const currentPos = secondaryWindowPositions[roomId] || defaultPos
      const currentSize = getSecondaryWindowSize(roomId)
      secondaryWindowResizeStateRef.current = {
        roomId,
        mode,
        startX: event.clientX,
        startY: event.clientY,
        originX: currentPos.x,
        originY: currentPos.y,
        originWidth: currentSize.width,
        originHeight: currentSize.height,
      }
      event.preventDefault()
      event.stopPropagation()
    },
    [getSecondaryWindowDefaultPosition, getSecondaryWindowSize, secondaryWindowPositions]
  )

  const handleChatWindowDragMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    setRoomContextMenu(null)
    setMessageContextMenu(null)
    if (event.button !== 0) return
    chatWindowDragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: chatWindowPosition.x,
      originY: chatWindowPosition.y,
    }
    event.preventDefault()
  }

  const getChatWindowResizeBounds = useCallback(() => {
    const maxWidthByViewport = Math.floor(window.innerWidth * (2 / 3))
    const maxWidth = Math.min(
      Math.max(CHAT_WINDOW_MIN_WIDTH, maxWidthByViewport),
      Math.max(CHAT_WINDOW_MIN_WIDTH, window.innerWidth - 24)
    )
    const maxHeight = Math.min(CHAT_WINDOW_MAX_HEIGHT, Math.max(CHAT_WINDOW_MIN_HEIGHT, window.innerHeight - 24))
    const minWidth = Math.min(CHAT_WINDOW_MIN_WIDTH, maxWidth)
    const minHeight = Math.min(CHAT_WINDOW_MIN_HEIGHT, maxHeight)
    return { minWidth, minHeight, maxWidth, maxHeight }
  }, [])

  const handleChatWindowResizeMouseDown = (
    mode: 'left' | 'right' | 'bottom' | 'corner',
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (event.button !== 0) return
    chatWindowResizeStateRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      originX: chatWindowPosition.x,
      originWidth: chatWindowSize.width,
      originHeight: chatWindowSize.height,
    }
    event.preventDefault()
    event.stopPropagation()
  }

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!dragStateRef.current) return
      const dx = event.clientX - dragStateRef.current.startX
      const dy = event.clientY - dragStateRef.current.startY
      const next = clampPosition(
        dragStateRef.current.originX + dx,
        dragStateRef.current.originY + dy,
        launcherSize.width,
        launcherSize.height
      )
      setPosition(next)
    }
    const onMouseUp = () => {
      if (!dragStateRef.current) return
      dragStateRef.current = null
      window.localStorage.setItem(storagePositionKey, JSON.stringify(position))
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [position, clampPosition, launcherSize.height, launcherSize.width, storagePositionKey])

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!chatWindowDragStateRef.current) return
      const dx = event.clientX - chatWindowDragStateRef.current.startX
      const dy = event.clientY - chatWindowDragStateRef.current.startY
      const next = clampPosition(
        chatWindowDragStateRef.current.originX + dx,
        chatWindowDragStateRef.current.originY + dy,
        chatWindowSize.width,
        chatWindowSize.height
      )
      setChatWindowPosition(next)
    }
    const onMouseUp = () => {
      if (!chatWindowDragStateRef.current) return
      chatWindowDragStateRef.current = null
      window.localStorage.setItem(chatWindowStoragePositionKey, JSON.stringify(chatWindowPosition))
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [chatWindowPosition, clampPosition, chatWindowSize.height, chatWindowSize.width, chatWindowStoragePositionKey])

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const state = chatWindowResizeStateRef.current
      if (!state) return

      const deltaX = event.clientX - state.startX
      const deltaY = event.clientY - state.startY
      const { minWidth, minHeight, maxWidth, maxHeight } = getChatWindowResizeBounds()

      let nextWidth = state.originWidth
      let nextHeight = state.originHeight
      let nextX = state.originX

      if (state.mode === 'right' || state.mode === 'corner') {
        nextWidth = Math.min(maxWidth, Math.max(minWidth, state.originWidth + deltaX))
      }
      if (state.mode === 'left') {
        nextWidth = Math.min(maxWidth, Math.max(minWidth, state.originWidth - deltaX))
        const shiftedX = state.originX + (state.originWidth - nextWidth)
        const minX = 8
        const maxX = Math.max(minX, window.innerWidth - nextWidth - 8)
        nextX = Math.min(Math.max(shiftedX, minX), maxX)
      }
      if (state.mode === 'bottom' || state.mode === 'corner') {
        nextHeight = Math.min(maxHeight, Math.max(minHeight, state.originHeight + deltaY))
      }

      setChatWindowSize({ width: nextWidth, height: nextHeight })
      if (state.mode === 'left') {
        setChatWindowPosition((prev) => clampPosition(nextX, prev.y, nextWidth, nextHeight))
      } else {
        setChatWindowPosition((prev) => clampPosition(prev.x, prev.y, nextWidth, nextHeight))
      }
    }

    const onMouseUp = () => {
      if (!chatWindowResizeStateRef.current) return
      chatWindowResizeStateRef.current = null
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [clampPosition, getChatWindowResizeBounds])

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const drag = secondaryWindowDragStateRef.current
      if (!drag) return
      const node = secondaryWindowRefs.current[drag.roomId]
      const width = node?.offsetWidth || CHAT_WINDOW_DEFAULT_WIDTH
      const height = node?.offsetHeight || CHAT_WINDOW_DEFAULT_HEIGHT
      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      const next = clampSecondaryPosition(drag.originX + dx, drag.originY + dy, width, height)
      setSecondaryWindowPositions((prev) => ({
        ...prev,
        [drag.roomId]: next,
      }))
    }

    const onMouseUp = () => {
      if (!secondaryWindowDragStateRef.current) return
      secondaryWindowDragStateRef.current = null
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [clampSecondaryPosition])

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const state = secondaryWindowResizeStateRef.current
      if (!state) return

      const deltaX = event.clientX - state.startX
      const deltaY = event.clientY - state.startY
      const { minWidth, minHeight, maxWidth, maxHeight } = getChatWindowResizeBounds()
      const roomId = state.roomId
      const currentPos = secondaryWindowPositions[roomId]
      const basePos = currentPos || { x: state.originX, y: state.originY }

      let nextWidth = state.originWidth
      let nextHeight = state.originHeight
      let nextX = basePos.x

      if (state.mode === 'right' || state.mode === 'corner') {
        nextWidth = Math.min(maxWidth, Math.max(minWidth, state.originWidth + deltaX))
      }
      if (state.mode === 'left') {
        nextWidth = Math.min(maxWidth, Math.max(minWidth, state.originWidth - deltaX))
        const shiftedX = state.originX + (state.originWidth - nextWidth)
        const minX = 8
        const maxX = Math.max(minX, window.innerWidth - nextWidth - 8)
        nextX = Math.min(Math.max(shiftedX, minX), maxX)
      }
      if (state.mode === 'bottom' || state.mode === 'corner') {
        nextHeight = Math.min(maxHeight, Math.max(minHeight, state.originHeight + deltaY))
      }

      const clamped = clampSecondaryPosition(nextX, basePos.y, nextWidth, nextHeight)
      setSecondaryWindowSizes((prev) => ({
        ...prev,
        [roomId]: { width: nextWidth, height: nextHeight },
      }))
      setSecondaryWindowPositions((prev) => ({
        ...prev,
        [roomId]: clamped,
      }))
    }

    const onMouseUp = () => {
      if (!secondaryWindowResizeStateRef.current) return
      secondaryWindowResizeStateRef.current = null
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [clampSecondaryPosition, getChatWindowResizeBounds, secondaryWindowPositions])

  const chatTargetRows = useMemo(() => {
    if (activeTab === 'employees') return filteredEmployees
    if (activeTab === 'companies') return filteredCompanies
    return []
  }, [activeTab, filteredCompanies, filteredEmployees])

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[70] inline-flex h-12 w-12 items-center justify-center rounded-full border border-sky-500 bg-sky-600 text-white shadow-lg transition hover:bg-sky-700"
          aria-label="채팅 열기"
          title="채팅"
        >
          <MessageCircle className="h-[21px] w-[21px]" />
          {unreadTotal > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
              {unreadTotal > 99 ? '99+' : unreadTotal}
            </span>
          ) : null}
        </button>
      ) : null}

      {open && positionReady ? (
        <div
          ref={launcherRef}
          className="fixed z-[80] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl"
          style={{
            width: launcherSize.width,
            height: launcherSize.height,
            left: 0,
            top: 0,
            transform: `translate(${position.x}px, ${position.y}px)`,
          }}
        >
          <div
            className="flex h-11 cursor-move items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3"
            onMouseDown={handleDragMouseDown}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
              <GripHorizontal className="h-4 w-4 text-zinc-500" />
              <span>채팅</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  wsConnected
                    ? 'bg-emerald-100 text-emerald-700'
                    : wsConnecting
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-zinc-200 text-zinc-600'
                }`}
                title={
                  !wsConnected && wsCloseInfo
                    ? `연결 종료(code=${wsCloseInfo.code}${wsCloseInfo.reason ? `, reason=${wsCloseInfo.reason}` : ''})`
                    : undefined
                }
              >
                {wsConnected ? '실시간 연결' : wsConnecting ? '연결 중' : '오프라인'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-7 items-center justify-center rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              aria-label="채팅 최소화"
            >
              최소화
            </button>
          </div>

          <div className="flex h-[calc(100%-44px)]">
            <aside className="w-20 border-r border-zinc-200 bg-zinc-50 px-1 py-2">
              <div className="space-y-1">
                {([
                  { key: 'employees', label: '직원', icon: UsersRound },
                  { key: 'companies', label: '고객사', icon: Building2 },
                  { key: 'rooms', label: '대화방', icon: MessageCircle },
                ] as const).map((tab) => {
                  const Icon = tab.icon
                  const active = activeTab === tab.key
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex w-full flex-col items-center justify-center rounded-md px-1 py-2 text-[10px] transition ${
                        active
                          ? 'bg-sky-600 text-white'
                          : 'text-zinc-600 hover:bg-zinc-100'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="mt-1">{tab.label}</span>
                    </button>
                  )
                })}
              </div>
            </aside>

            <section className="flex min-w-0 flex-1 flex-col">
              <div className="border-b border-zinc-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                    <input
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      placeholder="이름/방 검색"
                      className="h-8 w-full rounded border border-zinc-300 pl-7 pr-2 text-xs outline-none focus:border-zinc-500"
                    />
                  </div>
                  {activeTab === 'rooms' ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIncludeHiddenRooms((prev) => !prev)}
                        className={`rounded border px-2 py-1 text-[11px] font-medium ${
                          includeHiddenRooms
                            ? 'border-sky-500 bg-sky-50 text-sky-700'
                            : 'border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50'
                        }`}
                        aria-label="숨김방 포함 토글"
                      >
                        숨김 포함
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => void handleOpenGroupCreateModal()}
                          onMouseEnter={handleGroupCreateButtonMouseEnter}
                          onMouseLeave={handleGroupCreateButtonMouseLeave}
                          onFocus={() => setShowGroupCreateTooltip(true)}
                          onBlur={handleGroupCreateButtonMouseLeave}
                          className="relative inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                          aria-label="그룹채팅 만들기"
                        >
                          <MessageCircle className="h-4 w-4" />
                          <Plus className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full border border-white bg-white p-[1px] text-sky-600" />
                        </button>
                        {showGroupCreateTooltip ? (
                          <div className="pointer-events-none absolute right-0 top-9 z-20 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-[10px] font-medium text-white shadow">
                            그룹채팅 만들기
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {(activeTab === 'employees' || activeTab === 'companies') && participantsLoading ? (
                  <p className="py-6 text-center text-xs text-zinc-500">목록 불러오는 중...</p>
                ) : null}
                {(activeTab === 'employees' || activeTab === 'companies') && !participantsLoading ? (
                  chatTargetRows.length === 0 ? (
                    <p className="py-6 text-center text-xs text-zinc-500">대상자가 없습니다.</p>
                  ) : (
                    <div className="space-y-1">
                      {chatTargetRows.map((row) => {
                        const key = `${row.member_type}:${row.member_id}`
                        const busy = startingTargetKey === key
                        const presence = presenceMap[key]
                        const isOnline = presence?.online ?? Boolean(row.online)
                        return (
                          <div
                            key={key}
                            onDoubleClick={() => void handleStartChat(row)}
                            className="rounded px-2 py-2.5 transition hover:bg-zinc-50"
                            title="더블클릭으로 대화 시작"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <div className="relative h-8 w-8 shrink-0">
                                  {isOnline ? (
                                    <span className="pointer-events-none absolute -inset-[2px] block rounded-full border border-transparent border-r-emerald-200 border-t-emerald-400/80 animate-spin" />
                                  ) : null}
                                  <span
                                    className={`relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border bg-zinc-100 ${
                                      isOnline
                                        ? 'border-emerald-400 ring-1 ring-emerald-300/50 ring-offset-1 ring-offset-white'
                                        : 'border-zinc-200'
                                    }`}
                                  >
                                    {row.avatar_url ? (
                                      <img
                                        src={row.avatar_url}
                                        alt={row.name}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <span className="text-xs font-semibold text-zinc-700">
                                        {getParticipantInitial(row.name)}
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <p className="truncate text-[15px] font-medium text-zinc-800">{row.name}</p>
                              </div>
                              <UiButton
                                onClick={() => void handleStartChat(row)}
                                size="xs"
                                variant="secondary"
                                className="h-6 px-2 text-[10px] whitespace-nowrap"
                                disabled={busy}
                              >
                                {busy ? '입장중...' : '대화 시작'}
                              </UiButton>
                            </div>
                            {row.subtitle && row.subtitle.trim() && row.subtitle.trim() !== row.name.trim() ? (
                              <p className="truncate text-[13px] text-zinc-500">{row.subtitle}</p>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  )
                ) : null}

                {activeTab === 'rooms' && roomsLoading ? (
                  <p className="py-6 text-center text-xs text-zinc-500">대화방 불러오는 중...</p>
                ) : null}
                {activeTab === 'rooms' && !roomsLoading ? (
                  filteredRooms.length === 0 ? (
                    <p className="py-6 text-center text-xs text-zinc-500">대화방이 없습니다.</p>
                  ) : (
                    <div className="divide-y divide-zinc-100">
                      {filteredRooms.map((room) => {
                        const active = (activeWindowRoomId ?? selectedRoomId) === room.id
                        const roomListMembers = room.members || []
                        const roomTitle = getRoomDisplayName(room)
                        const roomCounterpart =
                          roomListMembers.find(
                            (member) =>
                              !(member.member_type === actor.type && member.member_id === actor.id)
                          ) || roomListMembers[0] || null
                        const companyAvatar = room.company_id
                          ? companyAvatarByCompanyId.get(Number(room.company_id))
                          : undefined
                        const matchedByName = participantAvatarByName.get(normalizeNameKey(roomTitle))
                        const roomAvatarUrl =
                          roomCounterpart?.avatar_url ||
                          companyAvatar?.avatarUrl ||
                          matchedByName?.avatarUrl ||
                          null
                        const roomAvatarName =
                          roomCounterpart?.name ||
                          companyAvatar?.name ||
                          matchedByName?.name ||
                          roomTitle
                        return (
                          <div
                            key={room.id}
                            onContextMenu={(event) => openRoomContextMenu(event, room.id)}
                            className={`group px-2 py-2 transition ${
                              active ? 'bg-sky-50' : 'hover:bg-zinc-50'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setRoomContextMenu(null)
                                if (openedRoomIds.includes(room.id)) {
                                  setChatWindowOpen(true)
                                  setActiveWindowRoomId(room.id)
                                  return
                                }
                                void openRoom(room.id)
                              }}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="grid grid-cols-[36px_minmax(0,1fr)] grid-rows-[auto_auto] gap-x-2 gap-y-0.5">
                                <span className="row-span-2 inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100">
                                  {room.room_type === 'group' ? (
                                    <UsersRound className="h-4 w-4 text-zinc-500" />
                                  ) : roomAvatarUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={roomAvatarUrl}
                                      alt={roomAvatarName}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-xs font-semibold text-zinc-700">
                                      {getParticipantInitial(roomAvatarName)}
                                    </span>
                                  )}
                                </span>

                                <div className="flex min-w-0 items-center justify-between gap-2">
                                  <div className="min-w-0 flex items-center gap-1.5">
                                    <p className="truncate text-xs font-medium text-zinc-800">
                                      {getRoomDisplayName(room)}
                                    </p>
                                    {room.is_hidden ? (
                                      <span className="shrink-0 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                                        숨김
                                      </span>
                                    ) : null}
                                    {room.is_muted ? (
                                      <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                        알림끔
                                      </span>
                                    ) : null}
                                  </div>
                                  {room.unread_count > 0 ? (
                                    <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                      {room.unread_count_display}
                                    </span>
                                  ) : null}
                                </div>

                                <div className="flex min-w-0 items-center justify-between gap-2">
                                  <p className="min-w-0 flex-1 truncate text-[11px] text-zinc-500">
                                    {room.last_message_preview || '메시지 없음'}
                                  </p>
                                  <p className="shrink-0 text-right text-[10px] text-zinc-400">
                                    {formatRoomListDateTime(room.last_message_at)}
                                  </p>
                                </div>
                              </div>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )
                ) : null}
              </div>
            </section>

          </div>
        </div>
      ) : null}

      {chatWindowOpen && selectedRoom && chatWindowPositionReady ? (
        <div
          ref={chatWindowRef}
          className="fixed flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl"
          onMouseDown={() => setActiveWindowRoomId(selectedRoom.id)}
          style={{
            width: chatWindowSize.width,
            height: chatWindowSize.height,
            left: 0,
            top: 0,
            zIndex: activeWindowRoomId === selectedRoom.id ? 95 : 90,
            transform: `translate(${chatWindowPosition.x}px, ${chatWindowPosition.y}px)`,
          }}
        >
          <div
            className="flex h-11 cursor-move items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3"
            onMouseDown={handleChatWindowDragMouseDown}
          >
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-semibold text-zinc-900">
                {buildRoomTitle(selectedRoom, roomMembers)}
              </p>
              {selectedRoom.room_type === 'group' ? (
                <button
                  type="button"
                  onClick={() => void handleRenameRoom(selectedRoom)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="대화방명 변경"
                  disabled={Boolean(renamingRoomId === selectedRoom.id)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <p className="shrink-0 text-[11px] text-zinc-500">
                {selectedRoomMemberSummary.label} {selectedRoomMemberSummary.count}명
              </p>
            </div>
            <div className="flex items-center gap-2">
              {typingNamesInSelectedRoom.length > 0 ? (
                <p className="max-w-[180px] truncate text-[11px] text-sky-700">
                  {typingNamesInSelectedRoom.join(', ')} 입력 중...
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => setShowRoomSearchPanel((prev) => !prev)}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-md border bg-white text-zinc-700 hover:bg-zinc-100 ${
                  showRoomSearchPanel ? 'border-sky-500 text-sky-700' : 'border-zinc-300'
                }`}
                aria-label="채팅 검색"
              >
                <Search className="h-4 w-4" />
              </button>
              <div className="relative" ref={roomActionMenuRef}>
                <button
                  type="button"
                  onClick={() => setRoomActionMenuOpen((prev) => !prev)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                  aria-label="대화방 메뉴"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {roomActionMenuOpen ? (
                  <div className="absolute right-0 top-8 z-20 w-44 rounded-md border border-zinc-200 bg-white p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => void handleViewRoomMembers()}
                      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100"
                    >
                      대화상대보기
                      <PanelRightOpen className="h-3.5 w-3.5 text-zinc-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRenameRoom(selectedRoom, { closeActionMenu: true })}
                      className="w-full rounded px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-400"
                      disabled={selectedRoom?.room_type !== 'group' || Boolean(renamingRoomId === selectedRoom?.id)}
                    >
                      {renamingRoomId === selectedRoom?.id ? '처리 중...' : '대화방명 변경'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleHideCurrentRoom()}
                      className="w-full rounded px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-400"
                      disabled={updatingRoomPreference}
                    >
                      {updatingRoomPreference
                        ? '처리 중...'
                        : selectedRoom?.is_hidden
                          ? '숨김 해제'
                          : '목록에서 숨기기'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleMuteCurrentRoom()}
                      className="w-full rounded px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-400"
                      disabled={updatingRoomPreference}
                    >
                      {updatingRoomPreference
                        ? '처리 중...'
                        : selectedRoom?.is_muted
                          ? '알림 켜기'
                          : '알림 끄기'}
                    </button>
                    {selectedRoom?.room_type !== 'company_bridge' ? (
                      <button
                        type="button"
                        onClick={() => void handleLeaveRoom()}
                        className="w-full rounded px-2 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-zinc-400"
                        disabled={leavingRoom}
                      >
                        {leavingRoom ? '처리 중...' : '대화방 나가기'}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeChatWindow}
                className="inline-flex h-7 items-center justify-center rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                aria-label="대화창 닫기"
              >
                닫기
              </button>
            </div>
          </div>

          {showRoomSearchPanel ? (
            <div className="border-b border-zinc-200 bg-white px-3 py-2">
              <div className="flex items-center gap-2">
                <input
                  value={roomSearchKeyword}
                  onChange={(event) => setRoomSearchKeyword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void executeRoomSearch()
                    }
                  }}
                  placeholder="대화 내용 검색 (2자 이상)"
                  className="h-8 min-w-0 flex-1 rounded border border-zinc-300 px-2 text-xs outline-none focus:border-zinc-500"
                />
                <UiButton
                  onClick={() => void executeRoomSearch()}
                  size="xs"
                  variant="secondary"
                  disabled={roomSearchLoading}
                >
                  {roomSearchLoading ? '검색중...' : '검색'}
                </UiButton>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-600">
                <div className="truncate">
                  총 {roomSearchTotal}건
                  {roomSearchResults.length > 0 && activeSearchResultIndex >= 0
                    ? ` · ${activeSearchResultIndex + 1}/${roomSearchResults.length}`
                    : ''}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveSearchResult(-1)}
                    disabled={roomSearchResults.length === 0}
                    className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="이전 검색 결과"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSearchResult(1)}
                    disabled={roomSearchResults.length === 0}
                    className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="다음 검색 결과"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {activeSearchResult ? (
                <button
                  type="button"
                  onClick={() => void jumpToMessageInSelectedRoom(activeSearchResult.message_id)}
                  className="mt-2 block w-full rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-left text-[11px] text-zinc-700 hover:bg-amber-100"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">
                      {activeSearchResult.sender_name || '알 수 없음'}
                    </span>
                    <span className="shrink-0 text-zinc-500">
                      {formatKoreanDateTime(activeSearchResult.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-zinc-600">{activeSearchResult.snippet}</p>
                </button>
              ) : null}
            </div>
          ) : null}

          <div ref={messageScrollRef} className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 p-3">
            {loadingHistory ? (
              <p className="pb-2 text-center text-[11px] text-zinc-500">이전 메시지 불러오는 중...</p>
            ) : null}
            {nextBeforeMessageId ? (
              <div className="mb-2 flex justify-center">
                <UiButton
                  variant="secondary"
                  size="xs"
                  onClick={() => void loadMessages(selectedRoom.id, { beforeMessageId: nextBeforeMessageId, prepend: true })}
                >
                  이전 메시지 불러오기
                </UiButton>
              </div>
            ) : null}

            {messagesLoading ? (
              <p className="py-6 text-center text-xs text-zinc-500">메시지 불러오는 중...</p>
            ) : null}
            {!messagesLoading && messages.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-500">첫 메시지를 보내보세요.</p>
            ) : null}
            {!messagesLoading && messages.length > 0 ? (
              <div className="space-y-3">
                {messages.map((message, index) => {
                  const mine =
                    message.sender_type === actor.type &&
                    Number(message.sender_id || 0) === actor.id
                  const senderLabel =
                    message.sender_name?.trim() ||
                    (message.sender_type === 'system' ? '시스템' : '사용자')
                  const showSenderLabel = !mine && message.message_type !== 'system'
                  const senderActorKey =
                    message.sender_id != null && message.sender_id > 0
                      ? toActorKey(message.sender_type, Number(message.sender_id))
                      : null
                  const senderAvatarUrl =
                    message.sender_profile_image_url ||
                    (senderActorKey ? participantAvatarMapRef.current.get(senderActorKey) || null : null) ||
                    participantAvatarByName.get(normalizeNameKey(senderLabel))?.avatarUrl ||
                    null
                  const currentKey = dateKey(message.created_at)
                  const prevKey = dateKey(messages[index - 1]?.created_at)
                  const showDateDivider = index === 0 || currentKey !== prevKey
                  const attachment = message.attachment || null
                  const attachmentKind =
                    attachment?.kind ?? (message.message_type === 'image' ? 'image' : 'file')
                  const isAttachmentMessage =
                    !message.is_deleted &&
                    Boolean(
                      attachment &&
                        (message.message_type === 'file' ||
                          message.message_type === 'image' ||
                          attachmentKind === 'file' ||
                          attachmentKind === 'image')
                    )
                  const isExpiredAttachment =
                    Boolean(attachment?.is_expired) || message.body === '만료된 파일입니다.'
                  const isImageKind = attachmentKind === 'image'
                  const inlinePreviewUrl = attachment ? getCachedInlineAttachmentUrl(attachment.id) : null
                  const isInlineAttachmentLoading = attachment ? Boolean(inlineAttachmentLoadingIds[attachment.id]) : false
                  const inlinePreviewCache = attachment ? inlineAttachmentUrlRef.current[attachment.id] : null
                  const isInlinePreviewExpired =
                    Boolean(
                      attachment &&
                        inlinePreviewCache &&
                        inlinePreviewCache.expiresAt <= Date.now() + 15_000
                    ) && !isExpiredAttachment
                  const isSearchHit = roomSearchMessageIdSet.has(message.id)
                  const isActiveSearchHit = activeSearchMessageId === message.id
                  const isJumpHighlight = jumpHighlightMessageId === message.id
                  const showReadStatus =
                    mine &&
                    !message.is_deleted &&
                    message.message_type !== 'system' &&
                    selectedRoomCounterpartKeys.length > 0
                  const isSystemMessage = message.message_type === 'system'
                  const allCounterpartsRead = showReadStatus
                    ? selectedRoomCounterpartKeys.every(
                        (actorKey) => (selectedRoomReadCursorState[actorKey] || 0) >= message.id
                      )
                    : false
                  const readStatusLabel = allCounterpartsRead ? '읽음' : '안읽음'
                  return (
                    <div key={message.id} id={`chat-msg-${message.id}`}>
                      {showDateDivider ? (
                        <div className="mb-2 text-center text-[11px] text-zinc-500">
                          {formatKoreanDayLabel(message.created_at)}
                        </div>
                      ) : null}
                      {isSystemMessage ? (
                        <div className="mb-1 text-center text-[11px] text-zinc-500">
                          {renderHighlightedText(
                            message.body || '시스템 메시지',
                            roomSearchKeyword,
                            'rounded bg-amber-200 px-0.5 text-zinc-700'
                          )}
                        </div>
                      ) : (
                        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`flex w-full flex-col ${mine ? 'items-end' : 'items-start'}`}>
                            {showSenderLabel && !mine ? (
                              <div className="grid w-full max-w-[calc(68.6667%+36px)] grid-cols-[36px_minmax(0,1fr)] grid-rows-[auto_auto] gap-x-1.5">
                                <span className="row-span-2 inline-flex h-9 w-9 shrink-0 items-center justify-center self-start overflow-hidden rounded-full border border-zinc-200 bg-zinc-100">
                                  {senderAvatarUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={senderAvatarUrl}
                                      alt={senderLabel}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-xs font-semibold text-zinc-700">
                                      {getParticipantInitial(senderLabel)}
                                    </span>
                                  )}
                                </span>
                                <p className="truncate text-xs font-medium text-zinc-500">{senderLabel}</p>
                                <div className="flex items-end gap-1.5">
                                  {message.is_deleted ? (
                                    <p className="max-w-full px-1 py-0.5 text-[11px] text-zinc-500">
                                      삭제된 메시지입니다.
                                    </p>
                                  ) : (
                                    <ChatBubble
                                      align="left"
                                      tone="other"
                                      className={`w-fit max-w-full px-2 py-1 transition ${
                                        isJumpHighlight
                                          ? 'ring-2 ring-amber-400'
                                          : ''
                                      } ${
                                        isSearchHit && !isJumpHighlight
                                          ? 'ring-1 ring-amber-300'
                                          : ''
                                      } ${
                                        isActiveSearchHit && !isJumpHighlight
                                          ? 'ring-2 ring-amber-400'
                                          : ''
                                      }`}
                                    >
                                      {isAttachmentMessage && attachment ? (
                                        <div className="space-y-2">
                                          <div className="flex items-start gap-2">
                                            <File className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                                            <div className="min-w-0">
                                              <p className="truncate text-sm font-medium">
                                                {attachment.file_name}
                                              </p>
                                              <p className="text-[11px] text-zinc-500">
                                                {formatFileSize(attachment.file_size)}
                                                {attachment.expires_at
                                                  ? ` · 만료 ${formatKoreanDateTime(attachment.expires_at)}`
                                                  : ''}
                                              </p>
                                            </div>
                                          </div>
                                          {isImageKind && !isExpiredAttachment ? (
                                            <button
                                              type="button"
                                              onClick={() => void handleOpenImageViewer(attachment.id, attachment.file_name)}
                                              className="block w-full overflow-hidden rounded border border-zinc-200 bg-zinc-100"
                                            >
                                              {inlinePreviewUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                  src={inlinePreviewUrl}
                                                  alt={attachment.file_name}
                                                  className="max-h-56 w-full object-contain"
                                                  onLoad={() => {
                                                    inlineAttachmentRetryRef.current.delete(attachment.id)
                                                  }}
                                                  onError={() => {
                                                    void handleInlineAttachmentImageError(attachment.id)
                                                  }}
                                                />
                                              ) : (
                                                <div className="flex h-32 items-center justify-center text-xs text-zinc-500">
                                                  {isInlineAttachmentLoading
                                                    ? '이미지 불러오는 중...'
                                                    : isInlinePreviewExpired
                                                      ? '미리보기 만료됨 · 클릭하여 다시보기'
                                                      : '이미지 준비 중...'}
                                                </div>
                                              )}
                                            </button>
                                          ) : null}
                                          {isExpiredAttachment ? (
                                            <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-600">
                                              만료된 파일입니다.
                                            </div>
                                          ) : null}
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <div className="group relative">
                                              <button
                                                type="button"
                                                onClick={() => void handleDownloadAttachment(attachment.id)}
                                                disabled={isExpiredAttachment}
                                                aria-label="다운로드"
                                                className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-300 bg-white text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                                              >
                                                <Download className="h-3.5 w-3.5" />
                                              </button>
                                              <div className="pointer-events-none absolute -top-7 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity duration-150 delay-500 group-hover:opacity-100">
                                                다운로드
                                              </div>
                                            </div>
                                            <div className="group relative">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  isImageKind
                                                    ? void handleOpenImageViewer(attachment.id, attachment.file_name)
                                                    : void handlePreviewAttachment(attachment.id)
                                                }
                                                disabled={
                                                  isExpiredAttachment ||
                                                  (!isImageKind &&
                                                    !canPreviewAttachment(attachment.content_type, attachment.file_name))
                                                }
                                                aria-label={isImageKind ? '확대' : '미리보기'}
                                                className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-300 bg-white text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                                              >
                                                <Eye className="h-3.5 w-3.5" />
                                              </button>
                                              <div className="pointer-events-none absolute -top-7 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity duration-150 delay-500 group-hover:opacity-100">
                                                {isImageKind ? '확대' : '미리보기'}
                                              </div>
                                            </div>
                                            {canSaveToCompany ? (
                                              <div className="group relative">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleOpenSaveCompanyPanel(
                                                      attachment.id,
                                                      attachment.file_name
                                                    )
                                                  }
                                                  disabled={isExpiredAttachment}
                                                  aria-label="고객사 저장"
                                                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-300 bg-white text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                  <Save className="h-3.5 w-3.5" />
                                                </button>
                                                <div className="pointer-events-none absolute -top-7 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity duration-150 delay-500 group-hover:opacity-100">
                                                  고객사 저장
                                                </div>
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="whitespace-pre-wrap text-xs">
                                          {renderHighlightedText(
                                            message.body || '',
                                            roomSearchKeyword,
                                            'rounded bg-amber-200 px-0.5 text-zinc-900'
                                          )}
                                        </p>
                                      )}
                                    </ChatBubble>
                                  )}
                                  <span className="mb-1 shrink-0 text-[10px] text-zinc-400">
                                    {formatTimeOnly(message.created_at)}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className={`flex w-full items-end gap-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                                {mine ? (
                                  <span className="mb-1 shrink-0 text-[10px] text-zinc-400">
                                    <span className={`${allCounterpartsRead ? 'text-emerald-600' : 'text-zinc-400'}`}>
                                      {showReadStatus ? readStatusLabel : ''}
                                    </span>
                                    {showReadStatus ? ' · ' : ''}
                                    {formatTimeOnly(message.created_at)}
                                  </span>
                                ) : null}
                                {message.is_deleted ? (
                                  <p className="max-w-[68.6667%] px-1 py-0.5 text-[11px] text-zinc-500">
                                    삭제된 메시지입니다.
                                  </p>
                                ) : (
                                  <ChatBubble
                                    align={mine ? 'right' : 'left'}
                                    tone={mine ? 'mine' : 'other'}
                                    onContextMenu={(event) => {
                                      if (!mine || message.message_type === 'system' || message.is_deleted) return
                                      openMessageContextMenu(event, message.id)
                                    }}
                                    className={`w-fit max-w-[68.6667%] px-2 py-1 transition ${
                                      isJumpHighlight
                                        ? mine
                                          ? 'ring-2 ring-amber-300'
                                          : 'ring-2 ring-amber-400'
                                        : ''
                                    } ${
                                      isSearchHit && !isJumpHighlight
                                        ? mine
                                          ? 'ring-1 ring-amber-200/90'
                                          : 'ring-1 ring-amber-300'
                                        : ''
                                    } ${
                                      isActiveSearchHit && !isJumpHighlight
                                        ? mine
                                          ? 'ring-2 ring-amber-200'
                                          : 'ring-2 ring-amber-400'
                                        : ''
                                    }`}
                                  >
                                  {isAttachmentMessage && attachment ? (
                                    <div className="space-y-2">
                                      <div className="flex items-start gap-2">
                                        <File className={`mt-0.5 h-4 w-4 shrink-0 ${mine ? 'text-sky-100' : 'text-zinc-500'}`} />
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-medium">
                                            {attachment.file_name}
                                          </p>
                                          <p className={`text-[11px] ${mine ? 'text-sky-100/90' : 'text-zinc-500'}`}>
                                            {formatFileSize(attachment.file_size)}
                                            {attachment.expires_at
                                              ? ` · 만료 ${formatKoreanDateTime(attachment.expires_at)}`
                                              : ''}
                                          </p>
                                        </div>
                                      </div>
                                      {isImageKind && !isExpiredAttachment ? (
                                        <button
                                          type="button"
                                          onClick={() => void handleOpenImageViewer(attachment.id, attachment.file_name)}
                                          className={`block w-full overflow-hidden rounded border ${
                                            mine
                                              ? 'border-sky-200/50 bg-sky-500/20'
                                              : 'border-zinc-200 bg-zinc-100'
                                          }`}
                                        >
                                          {inlinePreviewUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                              src={inlinePreviewUrl}
                                              alt={attachment.file_name}
                                              className="max-h-56 w-full object-contain"
                                              onLoad={() => {
                                                inlineAttachmentRetryRef.current.delete(attachment.id)
                                              }}
                                              onError={() => {
                                                void handleInlineAttachmentImageError(attachment.id)
                                              }}
                                            />
                                          ) : (
                                            <div className={`flex h-32 items-center justify-center text-xs ${mine ? 'text-sky-100' : 'text-zinc-500'}`}>
                                              {isInlineAttachmentLoading
                                                ? '이미지 불러오는 중...'
                                                : isInlinePreviewExpired
                                                  ? '미리보기 만료됨 · 클릭하여 다시보기'
                                                  : '이미지 준비 중...'}
                                            </div>
                                          )}
                                        </button>
                                      ) : null}
                                      {isExpiredAttachment ? (
                                        <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-600">
                                          만료된 파일입니다.
                                        </div>
                                      ) : null}
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <div className="group relative">
                                          <button
                                            type="button"
                                            onClick={() => void handleDownloadAttachment(attachment.id)}
                                            disabled={isExpiredAttachment}
                                            aria-label="다운로드"
                                            className={`inline-flex h-7 w-7 items-center justify-center rounded border text-[11px] disabled:cursor-not-allowed disabled:opacity-50 ${
                                              mine
                                                ? 'border-sky-200/50 bg-sky-500/30 text-white hover:bg-sky-500/40'
                                                : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                                            }`}
                                          >
                                            <Download className="h-3.5 w-3.5" />
                                          </button>
                                          <div className="pointer-events-none absolute -top-7 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity duration-150 delay-500 group-hover:opacity-100">
                                            다운로드
                                          </div>
                                        </div>
                                        <div className="group relative">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              isImageKind
                                                ? void handleOpenImageViewer(attachment.id, attachment.file_name)
                                                : void handlePreviewAttachment(attachment.id)
                                            }
                                            disabled={
                                              isExpiredAttachment ||
                                              (!isImageKind &&
                                                !canPreviewAttachment(attachment.content_type, attachment.file_name))
                                            }
                                            aria-label={isImageKind ? '확대' : '미리보기'}
                                            className={`inline-flex h-7 w-7 items-center justify-center rounded border text-[11px] disabled:cursor-not-allowed disabled:opacity-50 ${
                                              mine
                                                ? 'border-sky-200/50 bg-sky-500/30 text-white hover:bg-sky-500/40'
                                                : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                                            }`}
                                          >
                                            <Eye className="h-3.5 w-3.5" />
                                          </button>
                                          <div className="pointer-events-none absolute -top-7 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity duration-150 delay-500 group-hover:opacity-100">
                                            {isImageKind ? '확대' : '미리보기'}
                                          </div>
                                        </div>
                                        {canSaveToCompany ? (
                                          <div className="group relative">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleOpenSaveCompanyPanel(
                                                  attachment.id,
                                                  attachment.file_name
                                                )
                                              }
                                              disabled={isExpiredAttachment}
                                              aria-label="고객사 저장"
                                              className={`inline-flex h-7 w-7 items-center justify-center rounded border text-[11px] disabled:cursor-not-allowed disabled:opacity-50 ${
                                                mine
                                                  ? 'border-sky-200/50 bg-sky-500/30 text-white hover:bg-sky-500/40'
                                                  : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                                              }`}
                                            >
                                              <Save className="h-3.5 w-3.5" />
                                            </button>
                                            <div className="pointer-events-none absolute -top-7 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity duration-150 delay-500 group-hover:opacity-100">
                                              고객사 저장
                                            </div>
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="whitespace-pre-wrap text-xs">
                                      {renderHighlightedText(
                                        message.body || '',
                                        roomSearchKeyword,
                                        mine
                                          ? 'rounded bg-amber-200/85 px-0.5 text-sky-900'
                                          : 'rounded bg-amber-200 px-0.5 text-zinc-900'
                                      )}
                                    </p>
                                  )}
                                </ChatBubble>
                              )}
                              {!mine ? (
                                <span className="mb-1 shrink-0 text-[10px] text-zinc-400">
                                  {formatTimeOnly(message.created_at)}
                                </span>
                              ) : null}
                            </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>

          <div
            className={`${dragOverComposer ? 'bg-sky-50' : ''}`}
            onDragOver={(event) => {
              event.preventDefault()
              if (!selectedRoomId) return
              setDragOverComposer(true)
            }}
            onDragLeave={() => setDragOverComposer(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragOverComposer(false)
              if (!selectedRoomId) return
              const file = event.dataTransfer.files?.[0]
              if (!file) return
              void uploadAttachmentFile(file)
            }}
          >
            <ChatComposer
              value={roomMessageBodyMap[selectedRoom.id] || ''}
              onChange={handleMessageBodyChange}
              onSend={() => void handleSendMessage()}
              onFileSelect={(file) => void uploadAttachmentFile(file)}
              onImageSelect={(file) => void uploadAttachmentFile(file)}
              sendDisabled={sending || isMessageComposing || !((roomMessageBodyMap[selectedRoom.id] || '').trim())}
              uploading={uploadingAttachment}
              helperText="첨부파일은 자동 만료될 수 있습니다. 이미지 15일, 일반파일 30일 이후 미리보기/다운로드가 제한됩니다."
              isComposing={isMessageComposing}
              onCompositionStart={() => setIsMessageComposing(true)}
              onCompositionEnd={() => setIsMessageComposing(false)}
              onBlur={() => setIsMessageComposing(false)}
            />
          </div>

          {showSaveCompanyPanel ? (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 p-3">
              <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-3 shadow-xl">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-900">고객사 기타문서 저장</p>
                  <button
                    type="button"
                    onClick={() => setShowSaveCompanyPanel(false)}
                    className="rounded border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-700 hover:bg-zinc-50"
                  >
                    닫기
                  </button>
                </div>
                <p className="mb-2 truncate text-[11px] text-zinc-500">
                  파일: {saveTargetAttachment?.fileName || '-'}
                </p>
                <input
                  value={companySearchKeyword}
                  onChange={(e) => setCompanySearchKeyword(e.target.value)}
                  placeholder="고객사 검색"
                  className="h-8 w-full rounded border border-zinc-300 px-2 text-xs outline-none focus:border-zinc-500"
                />
                <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded border border-zinc-200 p-1">
                  {companyOptionsLoading ? (
                    <p className="px-2 py-2 text-[11px] text-zinc-500">고객사 불러오는 중...</p>
                  ) : companyOptions.length === 0 ? (
                    <p className="px-2 py-2 text-[11px] text-zinc-500">검색 결과가 없습니다.</p>
                  ) : (
                    companyOptions.map((company) => (
                      <button
                        key={company.id}
                        type="button"
                        onClick={() => setSelectedCompanyId(company.id)}
                        className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition ${
                          selectedCompanyId === company.id
                            ? 'bg-sky-50 text-sky-700'
                            : 'text-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        <span className="truncate">{company.company_name}</span>
                        {selectedCompanyId === company.id ? <span>선택됨</span> : null}
                      </button>
                    ))
                  )}
                </div>
                <input
                  value={saveDocumentTitle}
                  onChange={(e) => setSaveDocumentTitle(e.target.value)}
                  placeholder="문서 제목(선택)"
                  className="mt-2 h-8 w-full rounded border border-zinc-300 px-2 text-xs outline-none focus:border-zinc-500"
                />
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSaveCompanyPanel(false)}
                    className="rounded border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveAttachmentToCompany()}
                    disabled={!selectedCompanyId || Boolean(savingAttachmentId)}
                    className="rounded border border-sky-600 bg-sky-600 px-2.5 py-1 text-xs text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingAttachmentId ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div
            className={`absolute bottom-0 right-0 top-11 z-10 w-56 border-l border-zinc-200 bg-white shadow-xl transition-transform duration-200 ${
              showRoomMembersPanel ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="flex h-10 items-center justify-between border-b border-zinc-200 px-3">
              <p className="text-xs font-semibold text-zinc-700">대화 참여자</p>
              <button
                type="button"
                onClick={() => setShowRoomMembersPanel(false)}
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                aria-label="참여자 패널 닫기"
              >
                <PanelRightClose className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="h-[calc(100%-40px)] overflow-y-auto p-2">
              {selectedRoomMembersForPanel.length === 0 ? (
                <p className="px-1 py-2 text-[11px] text-zinc-500">참여자 정보가 없습니다.</p>
              ) : (
                <div className="space-y-1">
                  {selectedRoomMembersForPanel.map((member) => {
                    const mine = member.member_type === actor.type && member.member_id === actor.id
                    return (
                      <div
                        key={`${member.member_type}:${member.member_id}`}
                        className="flex items-center justify-between rounded px-1.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                      >
                        <span className="truncate">{member.name}</span>
                        {mine ? (
                          <span className="ml-2 shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-700">
                            나
                          </span>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div
            className="absolute left-0 top-11 z-30 h-[calc(100%-44px)] w-1.5 cursor-ew-resize"
            onMouseDown={(event) => handleChatWindowResizeMouseDown('left', event)}
          />
          <div
            className="absolute right-0 top-11 z-30 h-[calc(100%-44px)] w-1.5 cursor-ew-resize"
            onMouseDown={(event) => handleChatWindowResizeMouseDown('right', event)}
          />
          <div
            className="absolute bottom-0 left-0 z-30 h-1.5 w-full cursor-ns-resize"
            onMouseDown={(event) => handleChatWindowResizeMouseDown('bottom', event)}
          />
          <div
            className="absolute bottom-0 right-0 z-40 h-3.5 w-3.5 cursor-nwse-resize"
            onMouseDown={(event) => handleChatWindowResizeMouseDown('corner', event)}
          />
        </div>
      ) : null}

      {openedRooms
        .filter((room) => room.id !== selectedRoomId)
        .map((room, index) => {
          const sized = getSecondaryWindowSize(room.id)
          const defaultPos = getSecondaryWindowDefaultPosition(index)
          const positioned = secondaryWindowPositions[room.id] || defaultPos
          return (
            <div
              key={`room-window-${room.id}`}
              ref={(node) => {
                secondaryWindowRefs.current[room.id] = node
              }}
              className="fixed flex overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl"
              onMouseDown={() => setActiveWindowRoomId(room.id)}
              style={{
                width: sized.width,
                height: sized.height,
                minWidth: CHAT_WINDOW_MIN_WIDTH,
                minHeight: CHAT_WINDOW_MIN_HEIGHT,
                maxWidth: CHAT_WINDOW_BASE_WIDTH,
                maxHeight: CHAT_WINDOW_MAX_HEIGHT,
                overflow: 'hidden',
                left: positioned.x,
                top: positioned.y,
                zIndex: activeWindowRoomId === room.id ? 96 : 89,
              }}
            >
            <div className="flex min-w-0 flex-1 flex-col">
              <div
                className="flex h-11 cursor-move items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3"
                onMouseDown={(event) => handleSecondaryWindowDragMouseDown(room.id, index, event)}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <p
                    className="min-w-0 truncate text-left text-sm font-semibold text-zinc-900"
                    title={getRoomDisplayName(room)}
                  >
                    {getRoomDisplayName(room)}
                  </p>
                  {room.room_type === 'group' ? (
                    <button
                      type="button"
                      onClick={() => void handleRenameRoom(room)}
                      onMouseDown={(event) => event.stopPropagation()}
                      className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="대화방명 변경"
                      disabled={Boolean(renamingRoomId === room.id)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  {room.unread_count > 0 ? (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      {room.unread_count_display}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveWindowRoomId(room.id)
                      setSelectedRoomId(room.id)
                      setChatWindowOpen(true)
                      setShowRoomSearchPanel((prev) => (selectedRoomId === room.id ? !prev : true))
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-md border bg-white text-zinc-700 hover:bg-zinc-100 ${
                      selectedRoomId === room.id && showRoomSearchPanel ? 'border-sky-500 text-sky-700' : 'border-zinc-300'
                    }`}
                    aria-label="채팅 검색"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveWindowRoomId(room.id)
                      setSelectedRoomId(room.id)
                      setChatWindowOpen(true)
                      setRoomActionMenuOpen((prev) => (selectedRoomId === room.id ? !prev : true))
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                    aria-label="대화방 메뉴"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => closeRoomTab(room.id)}
                    onMouseDown={(event) => event.stopPropagation()}
                    className="inline-flex h-7 items-center justify-center rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                    aria-label="대화창 닫기"
                  >
                    닫기
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-white px-3 py-3">
                {roomMessagesLoadingMap[room.id] ? (
                  <p className="py-8 text-center text-xs text-zinc-500">메시지 불러오는 중...</p>
                ) : (roomMessagesMap[room.id] || []).length === 0 ? (
                  <p className="py-8 text-center text-xs text-zinc-500">메시지가 없습니다.</p>
                ) : (
                  <div className="space-y-3">
                    {(roomMessagesMap[room.id] || []).map((message) => {
                      const isMine =
                        message.sender_type === actor.type && Number(message.sender_id || 0) === actor.id
                      const isSystem = message.sender_type === 'system' || message.message_type === 'system'
                      const senderLabel =
                        message.sender_name?.trim() || (message.sender_type === 'system' ? '시스템' : '사용자')
                      const showSenderLabel = !isMine && message.message_type !== 'system'
                      const senderActorKey =
                        message.sender_id != null && message.sender_id > 0
                          ? toActorKey(message.sender_type, Number(message.sender_id))
                          : null
                      const senderAvatarUrl =
                        message.sender_profile_image_url ||
                        (senderActorKey ? participantAvatarMapRef.current.get(senderActorKey) || null : null) ||
                        participantAvatarByName.get(normalizeNameKey(senderLabel))?.avatarUrl ||
                        null
                      const attachment = message.attachment || null
                      const attachmentKind =
                        attachment?.kind ?? (message.message_type === 'image' ? 'image' : 'file')
                      const isAttachmentMessage =
                        !message.is_deleted &&
                        Boolean(
                          attachment &&
                            (message.message_type === 'file' ||
                              message.message_type === 'image' ||
                              attachmentKind === 'file' ||
                              attachmentKind === 'image')
                        )
                      const isExpiredAttachment =
                        Boolean(attachment?.is_expired) || message.body === '만료된 파일입니다.'
                      const isImageKind = attachmentKind === 'image'
                      const inlinePreviewUrl = attachment ? getCachedInlineAttachmentUrl(attachment.id) : null
                      const isInlineAttachmentLoading = attachment
                        ? Boolean(inlineAttachmentLoadingIds[attachment.id])
                        : false
                      const inlinePreviewCache = attachment ? inlineAttachmentUrlRef.current[attachment.id] : null
                      const isInlinePreviewExpired =
                        Boolean(
                          attachment &&
                            inlinePreviewCache &&
                            inlinePreviewCache.expiresAt <= Date.now() + 15_000
                        ) && !isExpiredAttachment
                      return (
                        <div key={`secondary-${room.id}-${message.id}`}>
                          {isSystem ? (
                            <p className="py-0.5 text-center text-[11px] text-zinc-400">
                              {message.body || '시스템 메시지'}
                            </p>
                          ) : (
                            <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                              <div className={`flex w-full flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                {showSenderLabel ? (
                                  <div className="mb-0.5 flex items-center gap-1.5 px-1">
                                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100">
                                      {senderAvatarUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={senderAvatarUrl}
                                          alt={senderLabel}
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <span className="text-xs font-semibold text-zinc-700">
                                          {getParticipantInitial(senderLabel)}
                                        </span>
                                      )}
                                    </span>
                                    <p className="text-xs font-medium text-zinc-500">{senderLabel}</p>
                                  </div>
                                ) : null}
                                <ChatBubble
                                  align={isMine ? 'right' : 'left'}
                                  tone={isMine ? 'mine' : 'other'}
                                  onContextMenu={(event) => {
                                    if (!isMine || message.message_type === 'system' || message.is_deleted) return
                                    openMessageContextMenu(event, message.id)
                                  }}
                                  className={`w-fit max-w-[68.6667%] px-2 py-1 text-xs ${!isMine && showSenderLabel ? 'ml-[46px]' : ''}`}
                                >
                                  {isAttachmentMessage && attachment ? (
                                    <div className="space-y-2">
                                      <div className="flex items-start gap-2">
                                        <File className={`mt-0.5 h-4 w-4 shrink-0 ${isMine ? 'text-sky-100' : 'text-zinc-500'}`} />
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-medium">{attachment.file_name}</p>
                                          <p className={`text-[11px] ${isMine ? 'text-sky-100/90' : 'text-zinc-500'}`}>
                                            {formatFileSize(attachment.file_size)}
                                            {attachment.expires_at
                                              ? ` · 만료 ${formatKoreanDateTime(attachment.expires_at)}`
                                              : ''}
                                          </p>
                                        </div>
                                      </div>
                                      {isImageKind && !isExpiredAttachment ? (
                                        <button
                                          type="button"
                                          onClick={() => void handleOpenImageViewer(attachment.id, attachment.file_name)}
                                          className={`block w-full overflow-hidden rounded border ${
                                            isMine
                                              ? 'border-sky-200/50 bg-sky-500/20'
                                              : 'border-zinc-200 bg-zinc-100'
                                          }`}
                                        >
                                          {inlinePreviewUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                              src={inlinePreviewUrl}
                                              alt={attachment.file_name}
                                              className="max-h-40 w-full object-contain"
                                              onLoad={() => {
                                                inlineAttachmentRetryRef.current.delete(attachment.id)
                                              }}
                                              onError={() => {
                                                void handleInlineAttachmentImageError(attachment.id)
                                              }}
                                            />
                                          ) : (
                                            <div className={`flex h-24 items-center justify-center text-xs ${isMine ? 'text-sky-100' : 'text-zinc-500'}`}>
                                              {isInlineAttachmentLoading
                                                ? '이미지 불러오는 중...'
                                                : isInlinePreviewExpired
                                                  ? '미리보기 만료됨 · 클릭하여 다시보기'
                                                  : '이미지 준비 중...'}
                                            </div>
                                          )}
                                        </button>
                                      ) : null}
                                      {isExpiredAttachment ? (
                                        <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-600">
                                          만료된 파일입니다.
                                        </div>
                                      ) : null}
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <UiButton
                                          type="button"
                                          variant={isMine ? 'soft' : 'secondary'}
                                          size="iconSm"
                                          onClick={() => void handleDownloadAttachment(attachment.id)}
                                          disabled={isExpiredAttachment}
                                        >
                                          <Download className="h-3.5 w-3.5" />
                                        </UiButton>
                                        <UiButton
                                          type="button"
                                          variant={isMine ? 'soft' : 'secondary'}
                                          size="iconSm"
                                          onClick={() =>
                                            isImageKind
                                              ? void handleOpenImageViewer(attachment.id, attachment.file_name)
                                              : void handlePreviewAttachment(attachment.id)
                                          }
                                          disabled={
                                            isExpiredAttachment ||
                                            (!isImageKind &&
                                              !canPreviewAttachment(attachment.content_type, attachment.file_name))
                                          }
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                        </UiButton>
                                        {canSaveToCompany ? (
                                          <UiButton
                                            type="button"
                                            variant={isMine ? 'soft' : 'secondary'}
                                            size="iconSm"
                                            onClick={() =>
                                              handleOpenSaveCompanyPanel(attachment.id, attachment.file_name)
                                            }
                                            disabled={isExpiredAttachment}
                                          >
                                            <Save className="h-3.5 w-3.5" />
                                          </UiButton>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="break-words">
                                      {message.is_deleted
                                        ? '삭제된 메시지입니다.'
                                        : message.body || (message.message_type === 'file' ? '파일 메시지' : '메시지')}
                                    </p>
                                  )}
                                  <p
                                    className={`mt-0.5 text-right text-[10px] ${
                                      isMine ? 'text-sky-100' : 'text-zinc-400'
                                    }`}
                                  >
                                    {formatTimeOnly(message.created_at)}
                                  </p>
                                </ChatBubble>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <ChatComposer
                value={roomMessageBodyMap[room.id] || ''}
                onChange={(value) =>
                  setRoomMessageBodyMap((prev) => ({ ...prev, [room.id]: value }))
                }
                onSend={() => void handleSendMessageForRoom(room.id)}
                onFileSelect={(file) => void uploadAttachmentFileToRoom(room.id, file)}
                onImageSelect={(file) => void uploadAttachmentFileToRoom(room.id, file)}
                sendDisabled={
                  !((roomMessageBodyMap[room.id] || '').trim()) ||
                  Boolean(roomSendingMap[room.id]) ||
                  uploadingAttachment
                }
                uploading={uploadingAttachment}
                helperText="첨부파일은 자동 만료될 수 있습니다. 이미지 15일, 일반파일 30일 이후 미리보기/다운로드가 제한됩니다."
                rows={2}
                wrapperClassName="border-zinc-200 px-2.5 py-2"
                textareaClassName="min-h-[46px] px-2.5 py-2"
              />
            </div>
            <div
              className="absolute left-0 top-11 z-30 h-[calc(100%-44px)] w-1.5 cursor-ew-resize"
              onMouseDown={(event) =>
                handleSecondaryWindowResizeMouseDown(room.id, index, 'left', event)
              }
            />
            <div
              className="absolute right-0 top-11 z-30 h-[calc(100%-44px)] w-1.5 cursor-ew-resize"
              onMouseDown={(event) =>
                handleSecondaryWindowResizeMouseDown(room.id, index, 'right', event)
              }
            />
            <div
              className="absolute bottom-0 left-0 z-30 h-1.5 w-full cursor-ns-resize"
              onMouseDown={(event) =>
                handleSecondaryWindowResizeMouseDown(room.id, index, 'bottom', event)
              }
            />
            <div
              className="absolute bottom-0 right-0 z-40 h-3.5 w-3.5 cursor-nwse-resize"
              onMouseDown={(event) =>
                handleSecondaryWindowResizeMouseDown(room.id, index, 'corner', event)
              }
            />
          </div>
        )})}

      {chatWindowOpen && messageContextMenu ? (
        <div
          ref={messageContextMenuRef}
          className="fixed z-[120] min-w-[120px] overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-xl"
          style={{
            left: messageContextMenu.x,
            top: messageContextMenu.y,
          }}
        >
          <button
            type="button"
            onClick={() => {
              const targetMessageId = messageContextMenu.messageId
              setMessageContextMenu(null)
              void handleDeleteMessage(targetMessageId)
            }}
            className="w-full px-3 py-1.5 text-left text-[12px] text-rose-600 hover:bg-rose-50"
          >
            메시지 삭제
          </button>
        </div>
      ) : null}

      {open && roomContextMenu ? (
        <div
          ref={roomContextMenuRef}
          className="fixed z-[120] min-w-[140px] overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-xl"
          style={{
            left: roomContextMenu.x,
            top: roomContextMenu.y,
          }}
        >
          <button
            type="button"
            onClick={() => {
              const targetRoom = rooms.find((room) => room.id === roomContextMenu.roomId)
              setRoomContextMenu(null)
              if (!targetRoom || targetRoom.room_type !== 'group') return
              void handleRenameRoom(targetRoom)
            }}
            disabled={
              Boolean(renamingRoomId && renamingRoomId === roomContextMenu.roomId) ||
              rooms.find((room) => room.id === roomContextMenu.roomId)?.room_type !== 'group'
            }
            className="w-full px-3 py-1.5 text-left text-[12px] text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {renamingRoomId && renamingRoomId === roomContextMenu.roomId ? '처리 중...' : '대화방명 변경'}
          </button>
          <button
            type="button"
            onClick={() => {
              const targetRoom = rooms.find((room) => room.id === roomContextMenu.roomId)
              setRoomContextMenu(null)
              if (!targetRoom) return
              void handleLeaveRoomByRoom(targetRoom)
            }}
            disabled={Boolean(leavingRoomId && leavingRoomId === roomContextMenu.roomId)}
            className="w-full px-3 py-1.5 text-left text-[12px] text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {leavingRoomId && leavingRoomId === roomContextMenu.roomId ? '처리 중...' : '나가기'}
          </button>
        </div>
      ) : null}

      {imageViewer ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setImageViewer(null)}
        >
          <div
            className="flex flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl"
            style={{
              width: imageViewerExpanded ? '92vw' : '66vw',
              height: imageViewerExpanded ? '92vh' : '66vh',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-11 items-center justify-between border-b border-zinc-700 px-3">
              <p className="truncate text-xs font-medium text-zinc-200">{imageViewer.fileName}</p>
              <div className="ml-3 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setImageViewerExpanded((prev) => !prev)}
                  className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-[11px] text-zinc-100 hover:bg-zinc-700"
                >
                  {imageViewerExpanded ? '창 줄이기' : '창 키우기'}
                </button>
                <button
                  type="button"
                  onClick={() => setImageViewerMode('fit')}
                  className={`rounded border px-2 py-1 text-[11px] ${
                    imageViewerMode === 'fit'
                      ? 'border-sky-500 bg-sky-600 text-white'
                      : 'border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
                  }`}
                >
                  창 맞춤
                </button>
                <button
                  type="button"
                  onClick={() => setImageViewerMode('original')}
                  className={`rounded border px-2 py-1 text-[11px] ${
                    imageViewerMode === 'original'
                      ? 'border-sky-500 bg-sky-600 text-white'
                      : 'border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
                  }`}
                >
                  원본 크기
                </button>
                <button
                  type="button"
                  onClick={() => setImageViewer(null)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                  aria-label="이미지 뷰어 닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div
              className={`min-h-0 flex-1 bg-zinc-900 ${
                imageViewerMode === 'original'
                  ? 'overflow-auto'
                  : 'overflow-hidden'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageViewer.url}
                alt={imageViewer.fileName}
                className={
                  imageViewerMode === 'original'
                    ? 'mx-auto my-0 max-w-none object-none'
                    : 'h-full w-full object-contain'
                }
              />
            </div>
          </div>
        </div>
      ) : null}

      {showGroupCreateModal ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 p-4"
          onClick={handleCloseGroupCreateModal}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-900">그룹채팅 만들기</p>
              <button
                type="button"
                onClick={handleCloseGroupCreateModal}
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                aria-label="그룹채팅 생성 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              value={groupRoomName}
              onChange={(event) => setGroupRoomName(event.target.value)}
              placeholder="그룹 이름 (비워두면 참여자 이름 자동)"
              className="mb-2 h-9 w-full rounded border border-zinc-300 px-2 text-xs outline-none focus:border-zinc-500"
            />
            <input
              value={groupMemberSearchKeyword}
              onChange={(event) => setGroupMemberSearchKeyword(event.target.value)}
              placeholder="직원 검색"
              className="mb-2 h-9 w-full rounded border border-zinc-300 px-2 text-xs outline-none focus:border-zinc-500"
            />

            <div className="h-64 overflow-y-auto rounded border border-zinc-200 p-1.5">
              {filteredGroupCandidates.length === 0 ? (
                <p className="px-2 py-3 text-xs text-zinc-500">선택 가능한 직원이 없습니다.</p>
              ) : (
                <div className="space-y-1">
                  {filteredGroupCandidates.map((row) => {
                    const key = `${row.member_type}:${row.member_id}`
                    const checked = Boolean(groupSelectedKeys[key])
                    return (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-zinc-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-zinc-800">{row.name}</p>
                          {row.subtitle ? (
                            <p className="truncate text-[11px] text-zinc-500">{row.subtitle}</p>
                          ) : null}
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleGroupCandidate(row)}
                          className="h-4 w-4 accent-sky-600"
                        />
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <p className="text-[11px] text-zinc-500">선택 인원 {selectedGroupMembers.length}명</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseGroupCreateModal}
                  className="rounded border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreateGroupRoom()}
                  disabled={creatingGroupRoom || selectedGroupMembers.length < 2}
                  className="rounded border border-sky-600 bg-sky-600 px-2.5 py-1 text-xs text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creatingGroupRoom ? '생성 중...' : '생성'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
