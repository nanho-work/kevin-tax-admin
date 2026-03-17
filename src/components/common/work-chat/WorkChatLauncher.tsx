'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import {
  Building2,
  GripHorizontal,
  MessageCircle,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Search,
  UsersRound,
  X,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import UiButton from '@/components/common/UiButton'
import { adminWorkChatApi, getAdminWorkChatErrorMessage } from '@/services/admin/workChatService'
import { clientWorkChatApi, getClientWorkChatErrorMessage } from '@/services/client/workChatService'
import { getAdminAccessToken, getClientAccessToken } from '@/services/http'
import type { WorkChatMessage, WorkChatParticipant, WorkChatParticipantsResponse, WorkChatRoom } from '@/types/workChat'

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
const CHAT_WINDOW_MAX_WIDTH = CHAT_WINDOW_BASE_WIDTH
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

function buildRoomTitle(room: WorkChatRoom, roomMembers: WorkChatParticipant[]): string {
  if (room.display_name && room.display_name.trim()) return room.display_name
  if (room.name && room.name.trim()) return room.name
  if (roomMembers.length === 0) return `채팅방 #${room.id}`
  return roomMembers.map((member) => member.name).join(', ')
}

function getRoomDisplayName(room: WorkChatRoom): string {
  if (room.display_name && room.display_name.trim()) return room.display_name
  if (room.name && room.name.trim()) return room.name
  return `대화방 #${room.id}`
}

function getParticipantInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed.slice(0, 1)
}

function includeByKeyword(row: WorkChatParticipant, keyword: string): boolean {
  const normalized = keyword.trim().toLowerCase()
  if (!normalized) return true
  return `${row.name} ${row.subtitle || ''}`.toLowerCase().includes(normalized)
}

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function toActorKey(memberType: string, memberId: number) {
  return `${memberType}:${memberId}`
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
  const messageType = raw?.message_type === 'system' ? 'system' : 'text'
  return {
    id,
    room_id: roomId,
    sender_type: senderType,
    sender_id: raw?.sender_id == null ? null : toNumber(raw.sender_id, 0),
    message_type: messageType,
    body: raw?.body == null ? null : String(raw.body),
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

function sortRoomsByRecentMessage(rows: WorkChatRoom[]): WorkChatRoom[] {
  return [...rows].sort((a, b) => {
    const aTs = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
    const bTs = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
    if (aTs !== bTs) return bTs - aTs
    return b.id - a.id
  })
}

function normalizeWsRoomPatch(raw: any): (Partial<WorkChatRoom> & { id: number }) | null {
  const target = raw?.room ?? raw
  const id = toNumber(target?.id ?? target?.room_id ?? target?.roomId)
  if (id <= 0) return null
  return {
    id,
    room_type: target?.room_type ?? target?.roomType,
    name: target?.name == null ? null : String(target.name),
    display_name: target?.display_name == null ? undefined : String(target.display_name),
    unread_count: target?.unread_count == null ? undefined : toNumber(target.unread_count, 0),
    unread_count_display:
      target?.unread_count_display == null ? undefined : String(target.unread_count_display),
    last_message_preview:
      target?.last_message_preview == null
        ? target?.last_message == null
          ? null
          : String(target.last_message)
        : String(target.last_message_preview),
    last_message_id:
      target?.last_message_id == null
        ? target?.last_message?.id == null
          ? undefined
          : toNumber(target.last_message.id, 0) || null
        : toNumber(target.last_message_id, 0) || null,
    last_message_at:
      target?.last_message_at == null
        ? target?.created_at == null
          ? null
          : String(target.created_at)
        : String(target.last_message_at),
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
  const [messages, setMessages] = useState<WorkChatMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [nextBeforeMessageId, setNextBeforeMessageId] = useState<number | null>(null)
  const [messageBody, setMessageBody] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [roomMembers, setRoomMembers] = useState<WorkChatParticipant[]>([])
  const [roomActionMenuOpen, setRoomActionMenuOpen] = useState(false)
  const [showRoomMembersPanel, setShowRoomMembersPanel] = useState(false)
  const [leavingRoom, setLeavingRoom] = useState(false)

  const [searchKeyword, setSearchKeyword] = useState('')
  const [startingTargetKey, setStartingTargetKey] = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [wsConnecting, setWsConnecting] = useState(false)
  const [presenceMap, setPresenceMap] = useState<Record<string, WsPresenceState>>({})
  const [typingMap, setTypingMap] = useState<Record<string, WsTypingState>>({})

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

  const launcherRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const chatWindowRef = useRef<HTMLDivElement | null>(null)
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
  const messageScrollRef = useRef<HTMLDivElement | null>(null)
  const firstOpenedRef = useRef(false)
  const wsRef = useRef<WebSocket | null>(null)
  const wsReconnectTimerRef = useRef<number | null>(null)
  const wsReconnectDelayRef = useRef(1000)
  const wsPingTimerRef = useRef<number | null>(null)
  const wsConnectedRef = useRef(false)
  const selectedRoomIdRef = useRef<number | null>(null)
  const openedRef = useRef(false)
  const subscribedRoomIdsRef = useRef<Set<number>>(new Set())
  const enteredRoomIdRef = useRef<number | null>(null)
  const typingStopTimerRef = useRef<number | null>(null)
  const typingExpiryTimersRef = useRef<Map<string, number>>(new Map())
  const typingSentRef = useRef(false)
  const participantNameMapRef = useRef<Map<string, string>>(new Map())

  const storagePositionKey = `work_chat_launcher_position_${portalType}`
  const chatWindowStoragePositionKey = `work_chat_window_position_${portalType}`
  const unreadTotal = useMemo(() => rooms.reduce((sum, room) => sum + (room.unread_count || 0), 0), [rooms])
  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) || null,
    [rooms, selectedRoomId]
  )

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

  const filteredEmployees = useMemo(
    () => employeeRows.filter((row) => includeByKeyword(row, searchKeyword)),
    [employeeRows, searchKeyword]
  )
  const filteredCompanies = useMemo(
    () => companyRows.filter((row) => includeByKeyword(row, searchKeyword)),
    [companyRows, searchKeyword]
  )
  const filteredRooms = useMemo(() => {
    const normalized = searchKeyword.trim().toLowerCase()
    if (!normalized) return rooms
    return rooms.filter((room) => {
      const title = (getRoomDisplayName(room) || '').toLowerCase()
      const preview = (room.last_message_preview || '').toLowerCase()
      return title.includes(normalized) || preview.includes(normalized)
    })
  }, [rooms, searchKeyword])

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

  useEffect(() => {
    const map = new Map<string, string>()
    ;[
      ...participants.admins,
      ...participants.client_accounts,
      ...participants.company_accounts,
      ...roomMembers,
    ].forEach((row) => {
      map.set(toActorKey(row.member_type, row.member_id), row.name)
    })
    participantNameMapRef.current = map
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

  const loadRooms = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setRoomsLoading(true)
      const res = await api.listRooms({ page: 1, size: 50 })
      const next = sortRoomsByRecentMessage(res.items || [])
      setRooms(next)
      return next
    } catch (error) {
      if (!options?.silent) toast.error(getErrorMessage(error))
      return []
    } finally {
      if (!options?.silent) setRoomsLoading(false)
    }
  }, [api, getErrorMessage])

  const loadParticipants = useCallback(async (options?: { silent?: boolean }) => {
    try {
      setParticipantsLoading(true)
      const res = await api.listParticipants()
      setParticipants(res)
    } catch (error) {
      if (!options?.silent) toast.error(getErrorMessage(error))
    } finally {
      setParticipantsLoading(false)
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
    async (roomId: number) => {
      try {
        const rows = await api.listRoomMembers(roomId)
        setRoomMembers(rows)
      } catch {
        setRoomMembers([])
      }
    },
    [api]
  )

  const loadMessages = useCallback(
    async (
      roomId: number,
      options?: { beforeMessageId?: number | null; prepend?: boolean; silent?: boolean }
    ) => {
      try {
        if (options?.prepend) setLoadingHistory(true)
        else if (!options?.silent) setMessagesLoading(true)

        const res = await api.listMessages(roomId, {
          size: 50,
          before_message_id: options?.beforeMessageId ?? undefined,
        })
        setNextBeforeMessageId(res.next_before_message_id)
        if (options?.prepend) {
          setMessages((prev) => {
            const merged = [...(res.items || []), ...prev]
            const dedup = new Map<number, WorkChatMessage>()
            merged.forEach((row) => dedup.set(row.id, row))
            return Array.from(dedup.values()).sort((a, b) => a.id - b.id)
          })
        } else {
          setMessages((res.items || []).sort((a, b) => a.id - b.id))
          await markSelectedRoomRead(roomId, (res.items || []).sort((a, b) => a.id - b.id))
        }
      } catch (error) {
        if (!options?.silent) toast.error(getErrorMessage(error))
      } finally {
        if (options?.prepend) setLoadingHistory(false)
        else if (!options?.silent) setMessagesLoading(false)
      }
    },
    [api, getErrorMessage, markSelectedRoomRead]
  )

  const openRoom = useCallback(
    async (roomId: number) => {
      setSelectedRoomId(roomId)
      setChatWindowOpen(true)
      setActiveTab('rooms')
      await Promise.all([loadMessages(roomId), loadRoomMembers(roomId)])
      requestAnimationFrame(() => {
        if (messageScrollRef.current) {
          messageScrollRef.current.scrollTop = messageScrollRef.current.scrollHeight
        }
      })
    },
    [loadMessages, loadRoomMembers]
  )

  const findExistingCompanyBridgeRoom = useCallback(
    (roomRows: WorkChatRoom[], target: WorkChatParticipant): WorkChatRoom | null => {
      const byMember = roomRows.find(
        (room) =>
          room.room_type === 'company_bridge' &&
          Array.isArray(room.members) &&
          room.members.some(
            (member) =>
              member.member_type === 'company_account' && member.member_id === target.member_id
          )
      )
      if (byMember) return byMember

      if (target.company_id) {
        const byCompanyId = roomRows.find(
          (room) => room.room_type === 'company_bridge' && room.company_id === target.company_id
        )
        if (byCompanyId) return byCompanyId
      }
      return null
    },
    []
  )

  const closeChatWindow = useCallback(() => {
    setChatWindowOpen(false)
    setSelectedRoomId(null)
    setMessages([])
    setRoomMembers([])
    setRoomActionMenuOpen(false)
    setShowRoomMembersPanel(false)
    setMessageBody('')
  }, [])

  const handleViewRoomMembers = useCallback(async () => {
    if (!selectedRoom) return
    setRoomActionMenuOpen(false)
    setShowRoomMembersPanel(true)
    if (selectedRoomMembersForPanel.length === 0) {
      await loadRoomMembers(selectedRoom.id)
    }
  }, [loadRoomMembers, selectedRoom, selectedRoomMembersForPanel.length])

  const handleLeaveRoom = useCallback(async () => {
    if (!selectedRoom || leavingRoom) return
    const confirmed = window.confirm('대화방에서 나가시겠습니까?')
    if (!confirmed) return

    try {
      setLeavingRoom(true)
      await api.leaveRoom(selectedRoom.id)
      setRooms((prev) => prev.filter((room) => room.id !== selectedRoom.id))
      closeChatWindow()
      setActiveTab('rooms')
      toast.success('대화방에서 나갔습니다.')
      void loadRooms({ silent: true })
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setLeavingRoom(false)
      setRoomActionMenuOpen(false)
    }
  }, [api, closeChatWindow, getErrorMessage, leavingRoom, loadRooms, selectedRoom])

  const handleStartChat = useCallback(
    async (target: WorkChatParticipant) => {
      const key = `${target.member_type}:${target.member_id}`
      try {
        setStartingTargetKey(key)

        if (target.member_type === 'company_account') {
          const localExisting = findExistingCompanyBridgeRoom(rooms, target)
          if (localExisting) {
            await openRoom(localExisting.id)
            return
          }

          const refreshed = await api.listRooms({ page: 1, size: 200, room_type: 'company_bridge' })
          const refreshedRooms = sortRoomsByRecentMessage(refreshed.items || [])
          setRooms((prev) => {
            const others = prev.filter((room) => room.room_type !== 'company_bridge')
            return sortRoomsByRecentMessage([...others, ...refreshedRooms])
          })

          const refreshedExisting = findExistingCompanyBridgeRoom(refreshedRooms, target)
          if (refreshedExisting) {
            await openRoom(refreshedExisting.id)
            return
          }
        }

        const res = await api.createRoom({
          room_type: target.member_type === 'company_account' ? 'company_bridge' : 'direct',
          members: [
            {
              member_type: target.member_type,
              member_id: target.member_id,
            },
          ],
        })
        setRooms((prev) => {
          const base = (res.room || {}) as WorkChatRoom
          if (!base.id) return prev
          const unreadCount = Math.max(0, Number(base.unread_count || 0))
          const nextRoom: WorkChatRoom = {
            ...base,
            unread_count: unreadCount,
            unread_count_display: base.unread_count_display || toUnreadCountDisplay(unreadCount),
          }
          const next = [nextRoom, ...prev.filter((room) => room.id !== nextRoom.id)]
          return sortRoomsByRecentMessage(next)
        })
        await openRoom(res.room.id)
        void loadRooms({ silent: true })
      } catch (error) {
        toast.error(getErrorMessage(error))
        if (axios.isAxiosError(error) && error.response?.status === 409) {
          void loadRooms({ silent: true })
        }
      } finally {
        setStartingTargetKey(null)
      }
    },
    [api, findExistingCompanyBridgeRoom, getErrorMessage, loadRooms, openRoom, rooms]
  )

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
    const body = messageBody.trim()
    if (!body || sending) return
    try {
      setSending(true)
      const sentByWs = sendWsEvent('chat.send', {
        room_id: selectedRoomId,
        body,
      })
      setMessageBody('')
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
      setSending(false)
    }
  }, [api, getErrorMessage, loadMessages, loadRooms, messageBody, selectedRoomId, sendWsEvent, sending, stopTypingSignal])

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

  const handleMessageBodyChange = useCallback(
    (value: string) => {
      setMessageBody(value)
      if (!selectedRoomIdRef.current || !wsConnectedRef.current) return

      const roomId = selectedRoomIdRef.current
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
    openedRef.current = open
  }, [open])

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId
  }, [selectedRoomId])

  useEffect(() => {
    wsConnectedRef.current = wsConnected
  }, [wsConnected])

  useEffect(() => {
    if (!open) return
    if (!wsConnected) {
      const roomPolling = window.setInterval(() => {
        void loadRooms({ silent: true })
      }, 10000)
      return () => window.clearInterval(roomPolling)
    }
  }, [open, wsConnected, loadRooms])

  useEffect(() => {
    if (!open || !selectedRoomId) return
    if (!wsConnected) {
      const messagePolling = window.setInterval(() => {
        void loadMessages(selectedRoomId, { silent: true })
      }, 5000)
      return () => window.clearInterval(messagePolling)
    }
  }, [open, selectedRoomId, wsConnected, loadMessages])

  useEffect(() => {
    if (open) return
    const token = portalType === 'admin' ? getAdminAccessToken() : getClientAccessToken()
    if (!token) return

    void loadRooms({ silent: true })
    const closedPolling = window.setInterval(() => {
      void loadRooms({ silent: true })
    }, 12000)
    return () => window.clearInterval(closedPolling)
  }, [open, portalType, loadRooms])

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
    if (!open) return

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
      if (disposed || !openedRef.current || wsReconnectTimerRef.current) return
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
      if (disposed || !openedRef.current) return
      const latestToken = portalType === 'admin' ? getAdminAccessToken() : getClientAccessToken()
      if (!latestToken) {
        setWsConnected(false)
        setWsConnecting(false)
        return
      }
      const wsUrl = buildWsUrl(portalType, latestToken)
      if (!wsUrl) return

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
            setRooms((prev) => {
              if (prev.some((room) => room.id === patch.id)) {
                return prev
              }
              const unreadCount = Math.max(0, patch.unread_count ?? 0)
              const next = [
                {
                  id: patch.id,
                  room_type: patch.room_type || 'direct',
                  name: patch.name || null,
                  display_name: patch.display_name || patch.name || null,
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
          const shouldSyncByApi = patch.unread_count == null
          setRooms((prev) => {
            const next = [...prev]
            const idx = next.findIndex((room) => room.id === patch.id)
            if (idx >= 0) {
              const base = next[idx]
              const unreadCount =
                patch.unread_count == null ? base.unread_count : Math.max(0, patch.unread_count)
              next[idx] = {
                ...base,
                ...patch,
                unread_count: unreadCount,
                unread_count_display:
                  patch.unread_count_display || toUnreadCountDisplay(unreadCount),
              }
            } else {
              const unreadCount = Math.max(0, patch.unread_count ?? 0)
              next.push({
                id: patch.id,
                room_type: patch.room_type || 'direct',
                name: patch.name || null,
                display_name: patch.display_name || patch.name || null,
                unread_count: unreadCount,
                unread_count_display: patch.unread_count_display || toUnreadCountDisplay(unreadCount),
                last_message_preview: patch.last_message_preview || null,
                last_message_id: patch.last_message_id ?? null,
                last_message_at: patch.last_message_at || null,
              })
            }
            return sortRoomsByRecentMessage(next)
          })
          if (shouldSyncByApi) {
            void loadRooms({ silent: true })
          }
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
          const shouldScroll = isViewingRoom && isAtBottom(messageScrollRef.current)

          if (isViewingRoom) {
            setMessages((prev) => {
              const map = new Map<number, WorkChatMessage>()
              prev.forEach((row) => map.set(row.id, row))
              map.set(message.id, message)
              return Array.from(map.values()).sort((a, b) => a.id - b.id)
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

      ws.onerror = () => {
        if (disposed) return
      }

      ws.onclose = () => {
        if (disposed) return
        setWsConnected(false)
        setWsConnecting(true)
        clearPingTimer()
        subscribedRoomIdsRef.current = new Set()
        enteredRoomIdRef.current = null
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
      subscribedRoomIdsRef.current = new Set()
      enteredRoomIdRef.current = null
      clearSocket()
    }
  }, [actor.id, actor.type, loadRooms, markRoomRead, open, portalType, sendWsEvent])

  useEffect(() => {
    if (!open || !wsConnected || rooms.length === 0) return
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
  }, [open, rooms, sendWsEvent, wsConnected])

  useEffect(() => {
    if (!open || !wsConnected) return
    const previousRoomId = enteredRoomIdRef.current
    if (previousRoomId && previousRoomId !== selectedRoomId) {
      sendWsEvent('chat.leave_room_view', { room_id: previousRoomId })
    }
    if (selectedRoomId) {
      sendWsEvent('chat.enter_room', { room_id: selectedRoomId })
    } else if (previousRoomId) {
      sendWsEvent('chat.leave_room_view', { room_id: previousRoomId })
    }
    enteredRoomIdRef.current = selectedRoomId
  }, [open, selectedRoomId, sendWsEvent, wsConnected])

  useEffect(() => {
    if (!open || !selectedRoomId) {
      stopTypingSignal()
    }
  }, [open, selectedRoomId, stopTypingSignal])

  useEffect(() => {
    setRoomActionMenuOpen(false)
    setShowRoomMembersPanel(false)
  }, [selectedRoomId])

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

  const handleDragMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    }
    event.preventDefault()
  }

  const handleChatWindowDragMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
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
    const maxWidth = Math.min(CHAT_WINDOW_MAX_WIDTH, Math.max(CHAT_WINDOW_MIN_WIDTH, window.innerWidth - 24))
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
          className="fixed bottom-6 right-6 z-[70] inline-flex h-14 min-w-14 items-center justify-center gap-2 rounded-full border border-sky-500 bg-sky-600 px-4 text-sm font-semibold text-white shadow-lg transition hover:bg-sky-700"
        >
          <MessageCircle className="h-5 w-5" />
          <span>채팅</span>
          {unreadTotal > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white ring-2 ring-white">
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
              >
                {wsConnected ? '실시간 연결' : wsConnecting ? '연결 중' : '오프라인'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100"
              aria-label="채팅 닫기"
            >
              <X className="h-4 w-4" />
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
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                  <input
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="이름/방 검색"
                    className="h-8 w-full rounded border border-zinc-300 pl-7 pr-2 text-xs outline-none focus:border-zinc-500"
                  />
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
                        const isEmployeeTab = activeTab === 'employees'
                        return (
                          <div
                            key={key}
                            onDoubleClick={() => void handleStartChat(row)}
                            className="rounded px-2 py-1.5 transition hover:bg-zinc-50"
                            title="더블클릭으로 대화 시작"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    presence?.online ? 'bg-emerald-500' : 'bg-zinc-300'
                                  }`}
                                />
                                {isEmployeeTab ? (
                                  <>
                                    {row.avatar_url ? (
                                      <img
                                        src={row.avatar_url}
                                        alt={row.name}
                                        className="h-6 w-6 rounded-full border border-zinc-200 object-cover"
                                      />
                                    ) : (
                                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-[10px] font-semibold text-zinc-700">
                                        {getParticipantInitial(row.name)}
                                      </span>
                                    )}
                                    <p className="truncate text-xs font-medium text-zinc-800">{row.name}</p>
                                  </>
                                ) : (
                                  <p className="truncate text-xs font-medium text-zinc-800">{row.name}</p>
                                )}
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
                            {!isEmployeeTab && row.subtitle && row.subtitle.trim() && row.subtitle.trim() !== row.name.trim() ? (
                              <p className="truncate text-[11px] text-zinc-500">{row.subtitle}</p>
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
                        const active = selectedRoomId === room.id
                        return (
                          <button
                            key={room.id}
                            type="button"
                            onClick={() => void openRoom(room.id)}
                            className={`w-full px-2 py-2 text-left transition ${
                              active ? 'bg-sky-50' : 'hover:bg-zinc-50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-xs font-medium text-zinc-800">
                                {getRoomDisplayName(room)}
                              </p>
                              {room.unread_count > 0 ? (
                                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                  {room.unread_count_display}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-0.5 flex items-center justify-between gap-2">
                              <p className="min-w-0 flex-1 truncate text-[11px] text-zinc-500">
                                {room.last_message_preview || '메시지 없음'}
                              </p>
                              <p className="shrink-0 text-right text-[10px] text-zinc-400">
                                {formatRoomListDateTime(room.last_message_at)}
                              </p>
                            </div>
                          </button>
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
          className="fixed z-[90] flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl"
          style={{
            width: chatWindowSize.width,
            height: chatWindowSize.height,
            left: 0,
            top: 0,
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
                  <div className="absolute right-0 top-8 z-20 w-36 rounded-md border border-zinc-200 bg-white p-1 shadow-lg">
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
                      onClick={() => void handleLeaveRoom()}
                      className="w-full rounded px-2 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-zinc-400"
                      disabled={leavingRoom}
                    >
                      {leavingRoom ? '나가는 중...' : '대화방 나가기'}
                    </button>
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
                  const currentKey = dateKey(message.created_at)
                  const prevKey = dateKey(messages[index - 1]?.created_at)
                  const showDateDivider = index === 0 || currentKey !== prevKey
                  return (
                    <div key={message.id}>
                      {showDateDivider ? (
                        <div className="mb-2 text-center text-[11px] text-zinc-500">
                          {formatKoreanDayLabel(message.created_at)}
                        </div>
                      ) : null}
                      <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className="flex items-end gap-1.5">
                          {mine ? (
                            <span className="mb-1 shrink-0 text-[10px] text-zinc-400">
                              {formatTimeOnly(message.created_at)}
                            </span>
                          ) : null}
                          <div
                            className={`max-w-[78%] rounded-lg border px-3 py-2 ${
                              mine
                                ? 'border-sky-600 bg-sky-600 text-white'
                                : 'border-zinc-200 bg-white text-zinc-800'
                            }`}
                          >
                            <p className="whitespace-pre-wrap text-sm">
                              {message.is_deleted ? '삭제된 메시지입니다.' : message.body || ''}
                            </p>
                            {mine && !message.is_deleted ? (
                              <div className="mt-1 flex items-center justify-end">
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteMessage(message.id)}
                                  className="text-[10px] text-sky-100 underline hover:text-white"
                                >
                                  삭제
                                </button>
                              </div>
                            ) : null}
                          </div>
                          {!mine ? (
                            <span className="mb-1 shrink-0 text-[10px] text-zinc-400">
                              {formatTimeOnly(message.created_at)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>

          <div className="border-t border-zinc-200 px-3 py-3.5">
            <div className="flex items-end gap-2">
              <textarea
                value={messageBody}
                onChange={(e) => handleMessageBodyChange(e.target.value)}
                placeholder="메시지를 입력하세요"
                rows={3}
                className="min-h-[58px] flex-1 resize-none rounded-2xl border border-zinc-300 bg-transparent px-3 py-2.5 text-sm leading-5 outline-none focus:border-zinc-500"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void handleSendMessage()
                  }
                }}
              />
              <UiButton
                onClick={() => void handleSendMessage()}
                variant="primary"
                size="sm"
                disabled={sending || !messageBody.trim()}
              >
                전송
              </UiButton>
            </div>
          </div>

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
    </>
  )
}
