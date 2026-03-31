'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Briefcase, CalendarCheck2, CheckSquare, FileText, GripVertical, ListTodo, Mail, NotebookPen, Trash2, UserCheck2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import Pagination from '@/components/common/Pagination'
import {
  getAdminDashboardAttendanceSummary,
  getAdminDashboardWidgetCatalog,
  getAdminDashboardWidgetLayout,
  saveAdminDashboardWidgetLayout,
} from '@/services/admin/dashboardWidgetService'
import { checkInAdmin, checkOutAdmin } from '@/services/admin/attendanceLogService'
import {
  carryOverAdminDashboardChecklist,
  createAdminDashboardChecklistItem,
  deleteAdminDashboardChecklistItem,
  getAdminDashboardChecklistByDate,
  patchAdminDashboardChecklistItem,
} from '@/services/admin/dashboardChecklistService'
import type { DashboardChecklistItemOut } from '@/types/dashboardChecklist'
import { getAdminDashboardNote, patchAdminDashboardNote } from '@/services/admin/dashboardNoteService'
import { fetchMyApprovalDocuments } from '@/services/admin/approvalDocumentService'
import { listMailAccounts, listMailMessages } from '@/services/admin/mailService'
import { fetchAdminNotificationUnreadCount } from '@/services/admin/notificationService'
import { fetchAdminWorkPostInbox } from '@/services/admin/workPostService'
import { getAdminWithholding33List } from '@/services/admin/withholding33Service'
import type {
  DashboardDeviceType,
  DashboardUserLayoutItem,
  DashboardUserLayoutResponse,
  DashboardWidgetCatalogItem,
} from '@/types/dashboardWidget'
import type { WorkPostInboxItem } from '@/types/workPost'
import { formatKSTDate, formatKSTDateTime, formatKSTDateTimeAssumeUTC } from '@/utils/dateTime'
import { resolveApiAssetUrl } from '@/utils/url'

type AdminWidgetData = {
  attendance_summary_profile?: {
    name: string | null
    position: string | null
    profileImageUrl: string | null
  }
  attendance_summary_meta?: {
    now: string | null
    timezone: string | null
  }
  my_attendance?: {
    workDate: string | null
    isClockedIn: boolean
    isClockedOut: boolean
    checkIn: string | null
    checkOut: string | null
    canClockIn: boolean
    canClockOut: boolean
  }
  my_leave_balance?: {
    granted: number
    remaining: number
    nextLeave: {
      requestId: number
      startDate: string
      endDate: string
      dDay: number
    } | null
  }
  approval_pending?: number
  mail_unread?: number
  mail_widget?: {
    companyUnreadTotal: number
    personalUnreadTotal: number
    companyUnreadItems: Array<{
      id: number
      mailAccountId: number
      sender: string
      subject: string
      receivedAt: string | null
      sortAt: string | null
    }>
    personalUnreadItems: Array<{
      id: number
      mailAccountId: number
      sender: string
      subject: string
      receivedAt: string | null
      sortAt: string | null
    }>
  }
  notification_unread?: number
  work_post_inbox?: {
    noticeTotal: number
    taskTotal: number
    noticeItems: WorkPostInboxItem[]
    taskItems: WorkPostInboxItem[]
  }
  withholding_pending?: number
}

type DragPayload = {
  widgetKey: string
  source: 'existing' | 'catalog'
}

const HEADER_WIDGET_ORDER = [
  'my_attendance',
  'my_leave_balance',
  'approval_pending',
  'mail_unread',
  'notification_unread',
  'work_post_inbox',
  'withholding_pending',
  'checklist_widget',
  'memo_widget',
] as const

const EXCLUDED_WIDGET_KEYS = new Set(['mail_ops_summary', 'tax_schedule_due'])
const GRID_COLS = 12
const ROW_HEIGHT = 84
const GRID_GAP = 16
const CARD_BASE_CLASS = 'rounded-md border border-zinc-200 bg-white px-4 py-3 shadow-sm'
const ADMIN_LOCAL_LAYOUT_STORAGE_KEY = 'admin-dashboard-unmanaged-layout-v1'
const ADMIN_LOCAL_FALLBACK_WIDGETS: DashboardWidgetCatalogItem[] = [
  {
    widget_id: -1001,
    widget_key: 'work_post_inbox',
    title: '공지/업무지시 수신함',
    description: '공지사항과 업무지시를 탭으로 확인',
    required_permission_code: null,
    default_w: 4,
    default_h: 3,
    min_w: 3,
    min_h: 2,
    max_w: 8,
    max_h: 6,
    supports_mobile: true,
  },
  {
    widget_id: -1002,
    widget_key: 'memo_widget',
    title: '메모장',
    description: '개인 메모를 기록합니다',
    required_permission_code: null,
    default_w: 3,
    default_h: 4,
    min_w: 3,
    min_h: 4,
    max_w: 3,
    max_h: 4,
    supports_mobile: true,
  },
  {
    widget_id: -1003,
    widget_key: 'checklist_widget',
    title: '오늘 체크리스트',
    description: '오늘 할 일을 관리합니다',
    required_permission_code: null,
    default_w: 2,
    default_h: 4,
    min_w: 2,
    min_h: 4,
    max_w: 2,
    max_h: 4,
    supports_mobile: true,
  },
]

function getKstDateString(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
}

function withAdminFallbackCatalog(items: DashboardWidgetCatalogItem[]): DashboardWidgetCatalogItem[] {
  const map = new Map(items.map((item) => [item.widget_key, item]))
  for (const fallback of ADMIN_LOCAL_FALLBACK_WIDGETS) {
    if (!map.has(fallback.widget_key)) {
      map.set(fallback.widget_key, fallback)
    }
  }
  return Array.from(map.values())
}

type LocalUnmanagedLayoutMap = Record<
  string,
  Pick<DashboardUserLayoutItem, 'grid_x' | 'grid_y' | 'grid_w' | 'grid_h' | 'visible' | 'sort_order'>
>

function readLocalUnmanagedLayout(): LocalUnmanagedLayoutMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(ADMIN_LOCAL_LAYOUT_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as LocalUnmanagedLayoutMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeLocalUnmanagedLayout(map: LocalUnmanagedLayoutMap) {
  if (typeof window === 'undefined') return
  if (Object.keys(map).length === 0) {
    window.localStorage.removeItem(ADMIN_LOCAL_LAYOUT_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(ADMIN_LOCAL_LAYOUT_STORAGE_KEY, JSON.stringify(map))
}

function applyLocalUnmanagedLayout(items: DashboardUserLayoutItem[]): DashboardUserLayoutItem[] {
  const localMap = readLocalUnmanagedLayout()
  return items.map((item) => {
    const local = localMap[item.widget_key]
    if (!local || item.widget_id > 0) return item
    return {
      ...item,
      grid_x: local.grid_x,
      grid_y: local.grid_y,
      grid_w: local.grid_w,
      grid_h: local.grid_h,
      visible: local.visible,
      sort_order: local.sort_order,
    }
  })
}

function buildLocalUnmanagedLayout(items: DashboardUserLayoutItem[]): LocalUnmanagedLayoutMap {
  const map: LocalUnmanagedLayoutMap = {}
  for (const item of items) {
    if (item.widget_id > 0) continue
    map[item.widget_key] = {
      grid_x: item.grid_x,
      grid_y: item.grid_y,
      grid_w: item.grid_w,
      grid_h: item.grid_h,
      visible: item.visible,
      sort_order: item.sort_order,
    }
  }
  return map
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function intersects(a: DashboardUserLayoutItem, b: DashboardUserLayoutItem): boolean {
  return !(
    a.grid_x + a.grid_w <= b.grid_x ||
    b.grid_x + b.grid_w <= a.grid_x ||
    a.grid_y + a.grid_h <= b.grid_y ||
    b.grid_y + b.grid_h <= a.grid_y
  )
}

function normalizeSortOrder(items: DashboardUserLayoutItem[]): DashboardUserLayoutItem[] {
  return [...items]
    .sort((a, b) => (a.sort_order - b.sort_order) || a.widget_id - b.widget_id)
    .map((item, index) => ({ ...item, sort_order: index }))
}

function resolveCollisions(
  items: DashboardUserLayoutItem[],
  movedWidgetKey: string
): DashboardUserLayoutItem[] {
  const next = items.map((item) => ({ ...item }))

  for (let pass = 0; pass < 500; pass += 1) {
    let changed = false

    for (let i = 0; i < next.length; i += 1) {
      for (let j = i + 1; j < next.length; j += 1) {
        const a = next[i]
        const b = next[j]
        if (!intersects(a, b)) continue

        const victim =
          a.widget_key === movedWidgetKey
            ? b
            : b.widget_key === movedWidgetKey
              ? a
              : b

        victim.grid_y += 1
        victim.grid_x = clamp(victim.grid_x, 0, GRID_COLS - victim.grid_w)
        changed = true
      }
    }

    if (!changed) break
  }

  return next
}

function sanitizeLayoutItems(items: DashboardUserLayoutItem[]): DashboardUserLayoutItem[] {
  const normalized = normalizeSortOrder(items).map((item) => {
    const nextW = clamp(item.grid_w, Math.max(1, item.min_w), Math.max(item.min_w, item.max_w))
    const nextH = clamp(item.grid_h, Math.max(1, item.min_h), Math.max(item.min_h, item.max_h))
    return {
      ...item,
      grid_w: nextW,
      grid_h: nextH,
      grid_x: clamp(item.grid_x, 0, GRID_COLS - nextW),
      grid_y: Math.max(0, item.grid_y),
    }
  })
  return normalizeSortOrder(resolveCollisions(normalized, '__bootstrap__'))
}

function applyPreferredWidgetSizes(items: DashboardUserLayoutItem[]): DashboardUserLayoutItem[] {
  return items.map((item) => {
    if (item.widget_key === 'my_attendance') {
      return {
        ...item,
        grid_w: 3,
        grid_h: 2,
        min_w: Math.max(3, item.min_w),
        min_h: Math.max(2, item.min_h),
        max_w: 3,
        max_h: 2,
      }
    }
    if (item.widget_key === 'mail_unread') {
      return {
        ...item,
        grid_w: 4,
        grid_h: 3,
        min_w: Math.max(4, item.min_w),
        min_h: Math.max(3, item.min_h),
        max_w: Math.max(4, item.max_w),
        max_h: Math.max(3, item.max_h),
      }
    }
    if (item.widget_key === 'memo_widget') {
      return {
        ...item,
        grid_w: 3,
        grid_h: 4,
        min_w: Math.max(3, item.min_w),
        min_h: Math.max(4, item.min_h),
        max_w: 3,
        max_h: 4,
      }
    }
    if (item.widget_key === 'checklist_widget') {
      return {
        ...item,
        grid_w: 2,
        grid_h: 4,
        min_w: Math.max(2, item.min_w),
        min_h: Math.max(4, item.min_h),
        max_w: 2,
        max_h: 4,
      }
    }
    return item
  })
}

type ChecklistItem = {
  id: number
  text: string
  done: boolean
  sortOrder: number
}

function renderSimpleCountCard(title: string, count?: number, subtitle?: string) {
  return (
    <div className="h-full">
      <p className="text-xs font-medium text-zinc-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-zinc-900">{(count ?? 0).toLocaleString('ko-KR')}</p>
      {subtitle ? <p className="mt-1 text-xs text-zinc-500">{subtitle}</p> : null}
    </div>
  )
}

function getWidgetHeaderIcon(widgetKey: string) {
  switch (widgetKey) {
    case 'my_attendance':
      return CalendarCheck2
    case 'my_leave_balance':
      return CalendarCheck2
    case 'approval_pending':
      return CheckSquare
    case 'mail_unread':
      return Mail
    case 'notification_unread':
      return Bell
    case 'work_post_inbox':
      return FileText
    case 'withholding_pending':
      return Briefcase
    case 'memo_widget':
      return NotebookPen
    case 'checklist_widget':
      return ListTodo
    default:
      return GripVertical
  }
}

function findAutoGridPosition(items: DashboardUserLayoutItem[], width: number, height: number): { x: number; y: number } {
  const occupied = items.map((item) => ({
    x1: item.grid_x,
    y1: item.grid_y,
    x2: item.grid_x + item.grid_w,
    y2: item.grid_y + item.grid_h,
  }))

  for (let y = 0; y < 200; y += 1) {
    for (let x = 0; x <= GRID_COLS - width; x += 1) {
      const x2 = x + width
      const y2 = y + height
      const collided = occupied.some((box) => !(x2 <= box.x1 || box.x2 <= x || y2 <= box.y1 || box.y2 <= y))
      if (!collided) return { x, y }
    }
  }
  return { x: 0, y: 0 }
}

export default function AdminDashboardWidgets() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [layout, setLayout] = useState<DashboardUserLayoutResponse | null>(null)
  const [catalog, setCatalog] = useState<DashboardWidgetCatalogItem[]>([])
  const [widgetData, setWidgetData] = useState<AdminWidgetData>({})
  const [error, setError] = useState<string | null>(null)
  const [deviceType] = useState<DashboardDeviceType>('desktop')
  const [editMode, setEditMode] = useState(false)
  const [workPostTab, setWorkPostTab] = useState<'notice' | 'task'>('notice')
  const [mailWidgetTab, setMailWidgetTab] = useState<'company' | 'personal'>('company')
  const [mailWidgetPageByTab, setMailWidgetPageByTab] = useState<{ company: number; personal: number }>({
    company: 1,
    personal: 1,
  })
  const [mailWidgetVisibleRows, setMailWidgetVisibleRows] = useState(3)
  const [draftItems, setDraftItems] = useState<DashboardUserLayoutItem[]>([])
  const [memoText, setMemoText] = useState('')
  const [memoTextColor, setMemoTextColor] = useState('#111827')
  const [memoBgColor, setMemoBgColor] = useState('#FFF9C4')
  const [memoFontSize, setMemoFontSize] = useState(14)
  const [memoInitialized, setMemoInitialized] = useState(false)
  const [checklistWorkDate] = useState(getKstDateString())
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([])
  const [checklistCollapsedDone, setChecklistCollapsedDone] = useState(false)
  const [checklistDraftText, setChecklistDraftText] = useState('')
  const [isAttendanceProfileImageBroken, setIsAttendanceProfileImageBroken] = useState(false)
  const [attendanceSubmitting, setAttendanceSubmitting] = useState<'check-in' | 'check-out' | null>(null)
  const gridRef = useRef<HTMLElement | null>(null)
  const mailWidgetListWrapRef = useRef<HTMLDivElement | null>(null)
  const checklistInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const [checklistPendingFocusId, setChecklistPendingFocusId] = useState<number | null>(null)
  const memoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const memoLastSavedSignatureRef = useRef('')
  const checklistTextSaveTimersRef = useRef<Record<number, ReturnType<typeof setTimeout> | undefined>>({})

  useEffect(() => {
    let mounted = true
    getAdminDashboardNote()
      .then((note) => {
        if (!mounted) return
        setMemoText(note.content || '')
        setMemoTextColor(note.text_color || '#111827')
        setMemoBgColor(note.bg_color || '#FFF9C4')
        setMemoFontSize(Number(note.font_size) || 14)
        memoLastSavedSignatureRef.current = JSON.stringify({
          content: note.content || '',
          text_color: note.text_color || '#111827',
          bg_color: note.bg_color || '#FFF9C4',
          font_size: Number(note.font_size) || 14,
        })
      })
      .catch(() => {
        // keep local defaults
      })
      .finally(() => {
        if (!mounted) return
        setMemoInitialized(true)
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!memoInitialized) return
    const payload = {
      content: memoText,
      text_color: memoTextColor,
      bg_color: memoBgColor,
      font_size: memoFontSize,
    }
    const signature = JSON.stringify(payload)
    if (signature === memoLastSavedSignatureRef.current) return
    if (memoSaveTimerRef.current) clearTimeout(memoSaveTimerRef.current)
    memoSaveTimerRef.current = setTimeout(() => {
      void patchAdminDashboardNote(payload)
        .then((saved) => {
          memoLastSavedSignatureRef.current = JSON.stringify({
            content: saved.content || '',
            text_color: saved.text_color || '#111827',
            bg_color: saved.bg_color || '#FFF9C4',
            font_size: Number(saved.font_size) || 14,
          })
        })
        .catch(() => {
          // no toast: autosave background failure
        })
    }, 400)
    return () => {
      if (memoSaveTimerRef.current) clearTimeout(memoSaveTimerRef.current)
    }
  }, [memoBgColor, memoFontSize, memoInitialized, memoText, memoTextColor])

  useEffect(() => {
    if (checklistPendingFocusId === null) return
    const target = checklistInputRefs.current[checklistPendingFocusId]
    target?.focus()
    setChecklistPendingFocusId(null)
  }, [checklistItems, checklistPendingFocusId])

  const loadChecklistByDate = useCallback(async () => {
    try {
      const checklist = await getAdminDashboardChecklistByDate(checklistWorkDate)
      const rawItems = Array.isArray(checklist?.items) ? checklist.items : []
      const mapped = rawItems
        .map((row: DashboardChecklistItemOut, idx: number) => ({
          id: Number(row?.item_id ?? 0),
          text: String(row?.content ?? ''),
          done: Boolean(row?.is_done ?? false),
          sortOrder: Number(row?.sort_order ?? idx),
        }))
        .filter((row: ChecklistItem) => row.id > 0)
        .sort((a: ChecklistItem, b: ChecklistItem) => (a.sortOrder - b.sortOrder) || (a.id - b.id))
      setChecklistItems(mapped)
    } catch {
      // keep empty mock-safe state
    }
  }, [checklistWorkDate])

  useEffect(() => {
    void loadChecklistByDate()
  }, [loadChecklistByDate])

  useEffect(() => {
    setIsAttendanceProfileImageBroken(false)
  }, [widgetData.attendance_summary_profile?.profileImageUrl])

  const visibleItems = useMemo(() => {
    if (editMode) return draftItems
    if (!layout) return [] as DashboardUserLayoutItem[]
    return layout.items
      .filter((item) => item.visible && !EXCLUDED_WIDGET_KEYS.has(item.widget_key))
      .sort((a, b) => (a.sort_order - b.sort_order) || a.widget_id - b.widget_id)
  }, [draftItems, editMode, layout])

  const catalogByKey = useMemo(() => {
    const map = new Map<string, DashboardWidgetCatalogItem>()
    for (const row of catalog) {
      map.set(row.widget_key, row)
    }
    return map
  }, [catalog])

  const headerToggleItems = useMemo(() => {
    const byKey = new Map(catalog.map((row) => [row.widget_key, row]))
    const ordered: DashboardWidgetCatalogItem[] = []
    for (const key of HEADER_WIDGET_ORDER) {
      const row = byKey.get(key)
      if (row) ordered.push(row)
    }
    return ordered
  }, [catalog])

  const rowCount = useMemo(() => {
    const maxBottom = visibleItems.reduce((acc, item) => Math.max(acc, item.grid_y + item.grid_h), 0)
    return Math.max(8, maxBottom + 2)
  }, [visibleItems])

  const loadWidgetData = useCallback(async (items: DashboardUserLayoutItem[]) => {
    const keys = new Set(items.map((item) => item.widget_key))
    const nextData: AdminWidgetData = {}
    const jobs: Array<Promise<void>> = []

    if (keys.has('my_attendance') || keys.has('my_leave_balance')) {
      jobs.push(
        getAdminDashboardAttendanceSummary()
          .then((res) => {
            nextData.attendance_summary_profile = {
              name: res.profile?.name ?? null,
              position: res.profile?.position ?? null,
              profileImageUrl: res.profile?.profile_image_url ?? null,
            }
            nextData.attendance_summary_meta = {
              now: res.meta?.now ?? null,
              timezone: res.meta?.timezone ?? null,
            }
            nextData.my_attendance = {
              workDate: res.attendance?.work_date ?? null,
              isClockedIn: Boolean(res.attendance?.is_clocked_in),
              isClockedOut: Boolean(res.attendance?.is_clocked_out),
              checkIn: res.attendance?.clock_in_at ?? null,
              checkOut: res.attendance?.clock_out_at ?? null,
              canClockIn: Boolean(res.attendance?.can_clock_in),
              canClockOut: Boolean(res.attendance?.can_clock_out),
            }
            nextData.my_leave_balance = {
              granted: Number(res.leave?.granted_days || 0),
              remaining: Number(res.leave?.remaining_days || 0),
              nextLeave: res.leave?.next_leave
                ? {
                    requestId: Number(res.leave.next_leave.request_id),
                    startDate: res.leave.next_leave.start_date,
                    endDate: res.leave.next_leave.end_date,
                    dDay: Number(res.leave.next_leave.d_day),
                  }
                : null,
            }
          })
          .catch(() => {
            nextData.attendance_summary_profile = {
              name: null,
              position: null,
              profileImageUrl: null,
            }
            nextData.attendance_summary_meta = {
              now: null,
              timezone: null,
            }
            nextData.my_attendance = {
              workDate: null,
              isClockedIn: false,
              isClockedOut: false,
              checkIn: null,
              checkOut: null,
              canClockIn: false,
              canClockOut: false,
            }
            nextData.my_leave_balance = { granted: 0, remaining: 0, nextLeave: null }
          })
      )
    }

    if (keys.has('approval_pending')) {
      jobs.push(
        fetchMyApprovalDocuments({ only_my_pending: true, offset: 0, limit: 1 })
          .then((res) => {
            nextData.approval_pending = Number(res.total || 0)
          })
          .catch(() => {
            nextData.approval_pending = 0
          })
      )
    }

    if (keys.has('mail_unread')) {
      jobs.push(
        (async () => {
          const accountsRes = await listMailAccounts(true)
          const companyAccounts = (accountsRes.items || []).filter((row) => row.account_scope === 'company')
          const personalAccounts = (accountsRes.items || []).filter((row) => row.account_scope === 'personal')

          const fetchScopeUnread = async (accountIds: number[]) => {
            const settled = await Promise.all(
              accountIds.map(async (accountId) => {
                try {
                  const res = await listMailMessages({
                    page: 1,
                    size: 100,
                    is_read: false,
                    mail_account_id: accountId,
                  })
                  return {
                    total: Number(res.total || 0),
                    items: (res.items || []).map((row) => ({
                      id: row.id,
                      mailAccountId: row.mail_account_id,
                      sender: row.from_name || row.from_email || '(발신자 없음)',
                      subject: row.subject || '(제목 없음)',
                      receivedAt: row.received_at || row.sent_at || null,
                      sortAt: row.received_at || row.sent_at || row.updated_at || row.created_at,
                    })),
                  }
                } catch {
                  return { total: 0, items: [] as Array<{
                    id: number
                    mailAccountId: number
                    sender: string
                    subject: string
                    receivedAt: string | null
                    sortAt: string | null
                  }> }
                }
              })
            )

            const total = settled.reduce((acc, row) => acc + row.total, 0)
            const mergedItems = settled
              .flatMap((row) => row.items)
              .sort((a, b) => {
                const aTs = a.sortAt ? new Date(a.sortAt).getTime() : 0
                const bTs = b.sortAt ? new Date(b.sortAt).getTime() : 0
                return bTs - aTs
              })
              .slice(0, 100)

            return { total, items: mergedItems }
          }

          const [companyUnread, personalUnread] = await Promise.all([
            fetchScopeUnread(companyAccounts.map((row) => row.id)),
            fetchScopeUnread(personalAccounts.map((row) => row.id)),
          ])

          nextData.mail_unread = companyUnread.total + personalUnread.total
          nextData.mail_widget = {
            companyUnreadTotal: companyUnread.total,
            personalUnreadTotal: personalUnread.total,
            companyUnreadItems: companyUnread.items,
            personalUnreadItems: personalUnread.items,
          }
        })()
          .catch(() => {
            nextData.mail_unread = 0
            nextData.mail_widget = {
              companyUnreadTotal: 0,
              personalUnreadTotal: 0,
              companyUnreadItems: [],
              personalUnreadItems: [],
            }
          })
      )
    }

    if (keys.has('notification_unread')) {
      jobs.push(
        fetchAdminNotificationUnreadCount()
          .then((count) => {
            nextData.notification_unread = Number(count || 0)
          })
          .catch(() => {
            nextData.notification_unread = 0
          })
      )
    }

    if (keys.has('work_post_inbox')) {
      jobs.push(
        Promise.all([
          fetchAdminWorkPostInbox({ page: 1, size: 5, post_type: 'notice' }),
          fetchAdminWorkPostInbox({ page: 1, size: 5, post_type: 'task' }),
        ])
          .then(([noticeRes, taskRes]) => {
            nextData.work_post_inbox = {
              noticeTotal: Number(noticeRes.total || 0),
              taskTotal: Number(taskRes.total || 0),
              noticeItems: noticeRes.items || [],
              taskItems: taskRes.items || [],
            }
          })
          .catch(() => {
            nextData.work_post_inbox = {
              noticeTotal: 0,
              taskTotal: 0,
              noticeItems: [],
              taskItems: [],
            }
          })
      )
    }

    if (keys.has('withholding_pending')) {
      jobs.push(
        getAdminWithholding33List({ page: 1, size: 1, review_status: 'draft' })
          .then((res) => {
            nextData.withholding_pending = Number(res.total || 0)
          })
          .catch(() => {
            nextData.withholding_pending = 0
          })
      )
    }

    await Promise.all(jobs)
    setWidgetData(nextData)
  }, [])

  const refreshAttendanceSummary = useCallback(async () => {
    try {
      const res = await getAdminDashboardAttendanceSummary()
      setWidgetData((prev) => ({
        ...prev,
        attendance_summary_profile: {
          name: res.profile?.name ?? null,
          position: res.profile?.position ?? null,
          profileImageUrl: res.profile?.profile_image_url ?? null,
        },
        attendance_summary_meta: {
          now: res.meta?.now ?? null,
          timezone: res.meta?.timezone ?? null,
        },
        my_attendance: {
          workDate: res.attendance?.work_date ?? null,
          isClockedIn: Boolean(res.attendance?.is_clocked_in),
          isClockedOut: Boolean(res.attendance?.is_clocked_out),
          checkIn: res.attendance?.clock_in_at ?? null,
          checkOut: res.attendance?.clock_out_at ?? null,
          canClockIn: Boolean(res.attendance?.can_clock_in),
          canClockOut: Boolean(res.attendance?.can_clock_out),
        },
        my_leave_balance: {
          granted: Number(res.leave?.granted_days || 0),
          remaining: Number(res.leave?.remaining_days || 0),
          nextLeave: res.leave?.next_leave
            ? {
                requestId: Number(res.leave.next_leave.request_id),
                startDate: res.leave.next_leave.start_date,
                endDate: res.leave.next_leave.end_date,
                dDay: Number(res.leave.next_leave.d_day),
              }
            : null,
        },
      }))
    } catch {
      // keep previous state
    }
  }, [])

  const handleAttendanceAction = useCallback(
    async (action: 'check-in' | 'check-out') => {
      if (attendanceSubmitting) return
      setAttendanceSubmitting(action)
      try {
        if (action === 'check-in') {
          await checkInAdmin()
          toast.success('출근 처리되었습니다.')
        } else {
          await checkOutAdmin()
          toast.success('퇴근 처리되었습니다.')
        }
        await refreshAttendanceSummary()
      } catch (error: any) {
        const detail = error?.response?.data?.detail
        const message =
          typeof detail === 'string'
            ? detail
            : detail?.message || '근태 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.'
        toast.error(message)
      } finally {
        setAttendanceSubmitting(null)
      }
    },
    [attendanceSubmitting, refreshAttendanceSummary]
  )

  const loadDashboard = useCallback(async () => {
    setError(null)
    const [layoutRes, catalogRes] = await Promise.all([
      getAdminDashboardWidgetLayout(deviceType),
      getAdminDashboardWidgetCatalog(),
    ])

    const filteredLayoutItems = (layoutRes.items || [])
      .filter((item) => item.visible && !EXCLUDED_WIDGET_KEYS.has(item.widget_key))
      .sort((a, b) => (a.sort_order - b.sort_order) || a.widget_id - b.widget_id)
    const filteredCatalog = withAdminFallbackCatalog(
      (catalogRes.items || []).filter((row) => !EXCLUDED_WIDGET_KEYS.has(row.widget_key))
    )

    let mergedItems = filteredLayoutItems
    const hasWorkPostWidget = mergedItems.some((item) => item.widget_key === 'work_post_inbox')
    if (!hasWorkPostWidget) {
      const widgetMeta = filteredCatalog.find((row) => row.widget_key === 'work_post_inbox')
      if (widgetMeta) {
        const maxBottom = mergedItems.reduce((acc, item) => Math.max(acc, item.grid_y + item.grid_h), 0)
        mergedItems = [
          ...mergedItems,
          {
            widget_id: widgetMeta.widget_id,
            widget_key: widgetMeta.widget_key,
            title: widgetMeta.title,
            description: widgetMeta.description,
            required_permission_code: widgetMeta.required_permission_code,
            grid_x: 0,
            grid_y: maxBottom,
            grid_w: widgetMeta.default_w,
            grid_h: widgetMeta.default_h,
            visible: true,
            sort_order: mergedItems.length,
            config_json: null,
            min_w: widgetMeta.min_w,
            min_h: widgetMeta.min_h,
            max_w: widgetMeta.max_w,
            max_h: widgetMeta.max_h,
            supports_mobile: widgetMeta.supports_mobile,
          },
        ]
      }
    }

    // Restore unmanaged fallback widgets (widget_id < 0) from local layout map,
    // because these widgets are not persisted to server layout payload.
    const localUnmanaged = readLocalUnmanagedLayout()
    const fallbackUnmanaged = filteredCatalog.filter((row) => row.widget_id < 0)
    for (const widgetMeta of fallbackUnmanaged) {
      const local = localUnmanaged[widgetMeta.widget_key]
      const alreadyExists = mergedItems.some((item) => item.widget_key === widgetMeta.widget_key)
      if (!local || alreadyExists) continue
      mergedItems = [
        ...mergedItems,
        {
          widget_id: widgetMeta.widget_id,
          widget_key: widgetMeta.widget_key,
          title: widgetMeta.title,
          description: widgetMeta.description,
          required_permission_code: widgetMeta.required_permission_code,
          grid_x: local.grid_x,
          grid_y: local.grid_y,
          grid_w: local.grid_w,
          grid_h: local.grid_h,
          visible: local.visible,
          sort_order: local.sort_order,
          config_json: null,
          min_w: widgetMeta.min_w,
          min_h: widgetMeta.min_h,
          max_w: widgetMeta.max_w,
          max_h: widgetMeta.max_h,
          supports_mobile: widgetMeta.supports_mobile,
        },
      ]
    }

    const sanitizedItems = sanitizeLayoutItems(
      applyPreferredWidgetSizes(applyLocalUnmanagedLayout(mergedItems))
    )
    setLayout({ ...layoutRes, items: sanitizedItems })
    setCatalog(filteredCatalog)
    setDraftItems(sanitizedItems)
    void loadWidgetData(sanitizedItems).catch(() => {
      // ignore: each widget loader already has fallback handling
    })
  }, [deviceType, loadWidgetData])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    loadDashboard()
      .catch(() => {
        if (!mounted) return
        setError('대시보드 위젯을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!mounted) return
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [loadDashboard])

  useEffect(() => {
    const target = mailWidgetListWrapRef.current
    if (!target || typeof ResizeObserver === 'undefined') return

    const recalc = (height: number) => {
      const headerHeight = 31
      const rowHeight = 31
      const maxRows = 8
      const minRows = 2
      const next = Math.max(minRows, Math.min(maxRows, Math.floor((height - headerHeight) / rowHeight)))
      setMailWidgetVisibleRows(next)
    }

    recalc(target.getBoundingClientRect().height)
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      recalc(entry.contentRect.height)
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [layout, editMode])

  const buildDroppedItems = useCallback(
    (
      sourceItems: DashboardUserLayoutItem[],
      payload: DragPayload,
      targetX: number,
      targetY: number
    ): DashboardUserLayoutItem[] => {
      const prev = sourceItems
      const existingIndex = prev.findIndex((item) => item.widget_key === payload.widgetKey)
      const catalogMeta = catalogByKey.get(payload.widgetKey)

      if (payload.source === 'catalog' && !catalogMeta) return prev

      let baseItems = [...prev]
      let moved: DashboardUserLayoutItem

      if (existingIndex >= 0) {
        moved = { ...baseItems[existingIndex] }
        baseItems[existingIndex] = moved
      } else {
        if (!catalogMeta) return prev
        moved = {
          widget_id: catalogMeta.widget_id,
          widget_key: catalogMeta.widget_key,
          title: catalogMeta.title,
          description: catalogMeta.description,
          required_permission_code: catalogMeta.required_permission_code,
          grid_x: 0,
          grid_y: 0,
          grid_w: catalogMeta.default_w,
          grid_h: catalogMeta.default_h,
          visible: true,
          sort_order: baseItems.length,
          config_json: null,
          min_w: catalogMeta.min_w,
          min_h: catalogMeta.min_h,
          max_w: catalogMeta.max_w,
          max_h: catalogMeta.max_h,
          supports_mobile: catalogMeta.supports_mobile,
        }
        baseItems.push(moved)
      }

      moved.grid_x = clamp(targetX, 0, GRID_COLS - moved.grid_w)
      moved.grid_y = Math.max(0, targetY)

      return normalizeSortOrder(resolveCollisions(baseItems, moved.widget_key))
    },
    [catalogByKey]
  )

  const handleDropToCell = useCallback((payload: DragPayload, targetX: number, targetY: number) => {
    setDraftItems((prev) => buildDroppedItems(prev, payload, targetX, targetY))
  }, [buildDroppedItems])

  const handlePersistLayoutItems = useCallback(
    async (items: DashboardUserLayoutItem[], silent: boolean) => {
      if (items.length === 0) return
      setSaving(true)
      try {
        const normalizedItems = normalizeSortOrder(items)
        writeLocalUnmanagedLayout(buildLocalUnmanagedLayout(normalizedItems))
        await saveAdminDashboardWidgetLayout(
          {
            replace_all: true,
            items: normalizedItems
              .filter((item) => item.widget_id > 0)
              .map((item, index) => ({
                widget_key: item.widget_key,
                grid_x: item.grid_x,
                grid_y: item.grid_y,
                grid_w: item.grid_w,
                grid_h: item.grid_h,
                visible: true,
                sort_order: index,
                config_json: item.config_json ?? {},
              })),
          },
          deviceType
        )
        setLayout((prev) => (prev ? { ...prev, items: normalizedItems } : prev))
        setDraftItems(normalizedItems)
        if (!silent) toast.success('대시보드 레이아웃을 저장했습니다.')
      } catch {
        toast.error(silent ? '위젯 위치 저장에 실패했습니다.' : '레이아웃 저장에 실패했습니다.')
      } finally {
        setSaving(false)
      }
    },
    [deviceType]
  )

  const handleGridDrop = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    if (!gridRef.current) return

    const raw = event.dataTransfer.getData('application/dashboard-widget')
    if (!raw) return

    let payload: DragPayload
    try {
      payload = JSON.parse(raw) as DragPayload
    } catch {
      return
    }

    const rect = gridRef.current.getBoundingClientRect()
    const cellWidth = (rect.width - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS
    const rowSpan = ROW_HEIGHT + GRID_GAP
    const relX = event.clientX - rect.left
    const relY = event.clientY - rect.top
    const rawX = Math.floor(relX / (cellWidth + GRID_GAP))
    const rawY = Math.floor(relY / rowSpan)
    const targetX = clamp(rawX, 0, GRID_COLS - 1)
    const targetY = Math.max(0, rawY)

    if (!editMode) {
      const sourceItems = (layout?.items || [])
        .filter((item) => item.visible && !EXCLUDED_WIDGET_KEYS.has(item.widget_key))
        .sort((a, b) => (a.sort_order - b.sort_order) || a.widget_id - b.widget_id)
      if (sourceItems.length === 0) return
      if (payload.source !== 'existing') return
      const nextItems = buildDroppedItems(sourceItems, payload, targetX, targetY)
      setLayout((prev) => (prev ? { ...prev, items: nextItems } : prev))
      setDraftItems(nextItems)
      void handlePersistLayoutItems(nextItems, true)
      return
    }
    handleDropToCell(payload, targetX, targetY)
  }, [buildDroppedItems, editMode, handleDropToCell, handlePersistLayoutItems, layout?.items])

  const handleSaveLayout = useCallback(async () => {
    if (draftItems.length === 0) {
      toast.error('최소 1개 이상의 위젯이 필요합니다.')
      return
    }
    await handlePersistLayoutItems(draftItems, false)
    setEditMode(false)
    await loadDashboard()
  }, [draftItems, handlePersistLayoutItems, loadDashboard])

  const handleHeaderToggleWidget = useCallback((widgetKey: string) => {
    const applyToggle = (items: DashboardUserLayoutItem[]) => {
      const exists = items.some((item) => item.widget_key === widgetKey)
      if (exists) {
        return sanitizeLayoutItems(applyPreferredWidgetSizes(items.filter((item) => item.widget_key !== widgetKey)))
      }
      const meta = catalogByKey.get(widgetKey)
      if (!meta) return items
      const width = Math.max(1, meta.default_w || meta.min_w || 1)
      const height = Math.max(1, meta.default_h || meta.min_h || 1)
      const pos = findAutoGridPosition(items, width, height)
      const appended: DashboardUserLayoutItem = {
        widget_id: meta.widget_id,
        widget_key: meta.widget_key,
        title: meta.title,
        description: meta.description,
        required_permission_code: meta.required_permission_code,
        grid_x: pos.x,
        grid_y: pos.y,
        grid_w: width,
        grid_h: height,
        visible: true,
        sort_order: items.length,
        config_json: null,
        min_w: meta.min_w,
        min_h: meta.min_h,
        max_w: meta.max_w,
        max_h: meta.max_h,
        supports_mobile: meta.supports_mobile,
      }
      return sanitizeLayoutItems(applyPreferredWidgetSizes([...items, appended]))
    }

    if (editMode) {
      setDraftItems((prev) => applyToggle(prev))
      return
    }

    const sourceItems = (layout?.items || [])
      .filter((item) => item.visible && !EXCLUDED_WIDGET_KEYS.has(item.widget_key))
      .sort((a, b) => (a.sort_order - b.sort_order) || a.widget_id - b.widget_id)
    const nextItems = applyToggle(sourceItems)
    setLayout((prev) => (prev ? { ...prev, items: nextItems } : prev))
    setDraftItems(nextItems)
    void handlePersistLayoutItems(nextItems, true)
  }, [catalogByKey, editMode, handlePersistLayoutItems, layout?.items])

  const renderWidgetBody = useCallback(
    (item: DashboardUserLayoutItem) => {
      switch (item.widget_key) {
        case 'my_attendance': {
          const data = widgetData.my_attendance
          const leaveData = widgetData.my_leave_balance
          const profile = widgetData.attendance_summary_profile
          const profileImageUrl = !isAttendanceProfileImageBroken
            ? resolveApiAssetUrl(profile?.profileImageUrl)
            : null
          return (
            <div className="h-full">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                  <UserCheck2 className="h-4 w-4 text-zinc-600" />
                  <span>근태</span>
                </div>
                <div>
                  {data?.canClockIn ? (
                    <button
                      type="button"
                      onClick={() => void handleAttendanceAction('check-in')}
                      disabled={attendanceSubmitting !== null || !data?.canClockIn}
                      className="inline-flex h-6 items-center rounded-md border border-sky-200 bg-sky-50 px-2 text-[11px] font-medium leading-none text-sky-700"
                    >
                      {attendanceSubmitting === 'check-in' ? '처리중' : '출근'}
                    </button>
                  ) : data?.canClockOut ? (
                    <button
                      type="button"
                      onClick={() => void handleAttendanceAction('check-out')}
                      disabled={attendanceSubmitting !== null || !data?.canClockOut}
                      className="inline-flex h-6 items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-medium leading-none text-emerald-700"
                    >
                      {attendanceSubmitting === 'check-out' ? '처리중' : '퇴근'}
                    </button>
                  ) : (
                    <span className="inline-flex h-6 items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 text-[11px] font-medium leading-none text-zinc-500">
                      완료
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <div className="h-[64px] w-[84px] overflow-hidden rounded-md border border-transparent bg-transparent">
                  <div className="mx-auto h-full w-3/4 overflow-hidden rounded-full">
                    {profileImageUrl ? (
                      <img
                        src={profileImageUrl}
                        alt={profile?.name || '프로필'}
                        className="block h-full w-full object-contain"
                        onError={() => setIsAttendanceProfileImageBroken(true)}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[13px] font-semibold text-zinc-500">
                        {(profile?.name || '-').slice(0, 1)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex h-[64px] flex-1 flex-col items-start justify-center rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[11px] leading-4 text-zinc-700">
                  <p className="truncate text-[14px]" title={`${profile?.name || '-'} ${profile?.position || ''}`.trim()}>
                    <span className="text-[15px] font-bold">{profile?.name || '-'}</span>
                    <span className="ml-1 font-normal">{profile?.position || ''}</span>
                  </p>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center">
                  <p className="text-[9px] text-zinc-500">휴가 D-day</p>
                  <p className="mt-1 text-[13px] font-semibold text-zinc-900">
                    {leaveData?.nextLeave ? `D-${leaveData.nextLeave.dDay}` : '-'}
                  </p>
                </div>
                <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center">
                  <p className="text-[9px] text-zinc-500">부여휴가</p>
                  <p className="mt-1 text-[13px] font-semibold text-zinc-900">
                    {Number(leaveData?.granted || 0).toLocaleString('ko-KR')}일
                  </p>
                </div>
                <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center">
                  <p className="text-[9px] text-zinc-500">잔여휴가</p>
                  <p className="mt-1 text-[13px] font-semibold text-zinc-900">
                    {Number(leaveData?.remaining || 0).toLocaleString('ko-KR')}일
                  </p>
                </div>
              </div>
            </div>
          )
        }
        case 'my_leave_balance': {
          const data = widgetData.my_leave_balance
          return (
            <div className="h-full">
              <p className="text-xs font-medium text-zinc-500">내 연차</p>
              <div className="mt-2 space-y-1 text-[11px] leading-4 text-zinc-700">
                <p>부여일수(granted_days): {Number(data?.granted || 0).toLocaleString('ko-KR')}</p>
                <p>잔여일수(remaining_days): {Number(data?.remaining || 0).toLocaleString('ko-KR')}</p>
                <p>다음휴가ID(request_id): {data?.nextLeave?.requestId ?? '-'}</p>
                <p>시작일(start_date): {data?.nextLeave ? formatKSTDate(data.nextLeave.startDate) : '-'}</p>
                <p>종료일(end_date): {data?.nextLeave ? formatKSTDate(data.nextLeave.endDate) : '-'}</p>
                <p>D-day(d_day): {data?.nextLeave ? data.nextLeave.dDay : '-'}</p>
              </div>
            </div>
          )
        }
        case 'approval_pending':
          return renderSimpleCountCard('내 결재 대기', widgetData.approval_pending, '처리 대기 문서')
        case 'mail_unread': {
          const mailData = widgetData.mail_widget || {
            companyUnreadTotal: 0,
            personalUnreadTotal: 0,
            companyUnreadItems: [],
            personalUnreadItems: [],
          }
          const activeItems =
            mailWidgetTab === 'company' ? mailData.companyUnreadItems : mailData.personalUnreadItems
          const activeCount =
            mailWidgetTab === 'company' ? mailData.companyUnreadTotal : mailData.personalUnreadTotal
          const listLabel = mailWidgetTab === 'company' ? '공용' : '개인'
          const pageSize = Math.max(1, mailWidgetVisibleRows)
          const activePageRaw = mailWidgetTab === 'company' ? mailWidgetPageByTab.company : mailWidgetPageByTab.personal
          const totalPages = Math.max(1, Math.ceil(Math.max(0, activeCount) / pageSize))
          const activePage = Math.min(Math.max(1, activePageRaw), totalPages)
          const start = (activePage - 1) * pageSize
          const visibleItems = activeItems.slice(start, start + pageSize)

          return (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                  <Mail className="h-4 w-4 text-zinc-600" />
                  <span>메일</span>
                </div>
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMailWidgetTab('company')}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${
                      mailWidgetTab === 'company'
                        ? 'border-sky-300 bg-sky-50 text-sky-700'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    공용
                    <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-700">
                      {mailData.companyUnreadTotal}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMailWidgetTab('personal')}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${
                      mailWidgetTab === 'personal'
                        ? 'border-sky-300 bg-sky-50 text-sky-700'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    개인
                    <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-700">
                      {mailData.personalUnreadTotal}
                    </span>
                  </button>
                </div>
              </div>
              <div className="mt-2 flex-1 space-y-1.5">
                {activeItems.length > 0 ? (
                  <div
                    ref={mailWidgetListWrapRef}
                    className="h-full overflow-hidden rounded-md bg-white"
                  >
                    <div className="grid grid-cols-4 border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold text-zinc-600">
                      <div className="col-span-1 truncate px-2 py-[9px]">보낸사람</div>
                      <div className="col-span-3 truncate border-l border-zinc-200 px-2 py-[9px]">제목</div>
                    </div>
                    <div className="divide-y divide-zinc-100">
                      {visibleItems.map((row) => (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => router.push(`/admin/mail/inbox?mailbox=all&account_id=${row.mailAccountId}&message_id=${row.id}`)}
                          className="grid w-full grid-cols-4 text-left text-xs transition hover:bg-zinc-50"
                          title={`${row.sender} | ${row.subject}`}
                        >
                          <div className="col-span-1 truncate px-2 py-[9px] font-medium text-zinc-700">{row.sender}</div>
                          <div className="col-span-3 truncate border-l border-zinc-100 px-2 py-[9px] text-zinc-800">{row.subject}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-6 text-center text-xs text-zinc-500">
                    {listLabel} 신규 메일이 없습니다.
                  </div>
                )}
              </div>
              <div className="mt-1 grid grid-cols-3 items-center">
                <div />
                {activeCount > pageSize ? (
                  <Pagination
                    className="mt-0 justify-center gap-1 text-[11px]"
                    page={activePage}
                    total={activeCount}
                    limit={pageSize}
                    showFirstLast={false}
                    windowSize={1}
                    buttonSize="xs"
                    buttonClassName="!h-5 !min-w-[18px] !border-0 !px-1 !text-[10px]"
                    onPageChange={(nextPage) =>
                      setMailWidgetPageByTab((prev) => ({
                        ...prev,
                        [mailWidgetTab]: nextPage,
                      }))
                    }
                  />
                ) : (
                  <div />
                )}
                <p className="text-right text-[11px] text-zinc-500">
                  안읽은 메일 {activeCount === undefined ? 0 : activeCount}건
                </p>
              </div>
            </div>
          )
        }
        case 'notification_unread':
          return renderSimpleCountCard('미읽음 알림', widgetData.notification_unread, '새 알림')
        case 'work_post_inbox':
          return (
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setWorkPostTab('notice')}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${
                    workPostTab === 'notice' ? 'bg-sky-100 text-sky-700' : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  공지사항 {Number(widgetData.work_post_inbox?.noticeTotal || 0)}
                </button>
                <button
                  type="button"
                  onClick={() => setWorkPostTab('task')}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${
                    workPostTab === 'task' ? 'bg-indigo-100 text-indigo-700' : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  업무지시 {Number(widgetData.work_post_inbox?.taskTotal || 0)}
                </button>
              </div>
              <div className="mt-2 flex-1 space-y-1">
                {(workPostTab === 'notice'
                  ? widgetData.work_post_inbox?.noticeItems || []
                  : widgetData.work_post_inbox?.taskItems || []
                ).map((post) => (
                  <button
                    key={post.receipt_id}
                    type="button"
                    onClick={() =>
                      router.push(
                        `/admin/staff/work-posts?source_type=work_post&source_id=${post.post_id}`
                      )
                    }
                    className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-left hover:border-zinc-300"
                  >
                    <p className="line-clamp-1 text-xs font-medium text-zinc-800">{post.title}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {formatKSTDateTimeAssumeUTC(post.published_at || post.created_at, '-')}
                    </p>
                  </button>
                ))}
                {(workPostTab === 'notice'
                  ? widgetData.work_post_inbox?.noticeItems || []
                  : widgetData.work_post_inbox?.taskItems || []
                ).length === 0 ? (
                  <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-6 text-center text-xs text-zinc-500">
                    표시할 {workPostTab === 'notice' ? '공지사항' : '업무지시'}이 없습니다.
                  </div>
                ) : null}
              </div>
            </div>
          )
        case 'withholding_pending':
          return renderSimpleCountCard('원천세 검토 대기', widgetData.withholding_pending, '검토 전 건수')
        case 'checklist_widget': {
          const activeItems = checklistItems.filter((row) => row.text.trim().length > 0)
          const doneCount = activeItems.filter((row) => row.done).length
          const totalCount = activeItems.length
          const visibleRows = checklistItems.filter((row) => !(checklistCollapsedDone && row.done))

          const createFromDraft = () => {
            const content = checklistDraftText.trim()
            if (!content) return
            void createAdminDashboardChecklistItem({
              work_date: checklistWorkDate,
              content,
              sort_order: checklistItems.length,
            })
              .then(async (created) => {
                setChecklistDraftText('')
                await loadChecklistByDate()
                const createdId = Number(created?.item_id ?? 0)
                if (createdId > 0) setChecklistPendingFocusId(createdId)
              })
              .catch(() => {
                toast.error('체크리스트 항목 생성에 실패했습니다.')
              })
          }

          const createAfter = (index: number) => {
            const base = checklistItems[index]
            if (!base || base.text.trim().length === 0) return
            void createAdminDashboardChecklistItem({
              work_date: checklistWorkDate,
              content: '새 할 일',
              sort_order: index + 1,
            })
              .then(async (created) => {
                await loadChecklistByDate()
                const createdId = Number(created?.item_id ?? 0)
                if (createdId > 0) setChecklistPendingFocusId(createdId)
              })
              .catch(() => {
                toast.error('체크리스트 항목 생성에 실패했습니다.')
              })
          }

          const removeAt = (index: number) => {
            const target = checklistItems[index]
            if (!target?.id) return
            const prevRow = checklistItems[index - 1] ?? checklistItems[index + 1] ?? null
            void deleteAdminDashboardChecklistItem(target.id)
              .then(async () => {
                await loadChecklistByDate()
                if (prevRow) setChecklistPendingFocusId(prevRow.id)
              })
              .catch(() => {
                toast.error('체크리스트 항목 삭제에 실패했습니다.')
              })
          }

          const updateText = (targetId: number, text: string) => {
            setChecklistItems((prev) => prev.map((row) => (row.id === targetId ? { ...row, text } : row)))
            if (checklistTextSaveTimersRef.current[targetId]) {
              clearTimeout(checklistTextSaveTimersRef.current[targetId])
            }
            checklistTextSaveTimersRef.current[targetId] = setTimeout(() => {
              const row = checklistItems.find((item) => item.id === targetId)
              const sortOrder = row?.sortOrder ?? 0
              if (text.trim().length === 0) return
              void patchAdminDashboardChecklistItem(targetId, {
                content: text,
                sort_order: sortOrder,
              }).catch(() => {
                // silent autosave failure
              })
            }, 350)
          }

          const toggleDone = (targetId: number) => {
            const row = checklistItems.find((item) => item.id === targetId)
            const nextDone = !Boolean(row?.done)
            setChecklistItems((prev) => prev.map((item) => (item.id === targetId ? { ...item, done: nextDone } : item)))
            void patchAdminDashboardChecklistItem(targetId, {
              is_done: nextDone,
              sort_order: row?.sortOrder ?? 0,
            }).catch(() => {
              toast.error('체크 상태 저장에 실패했습니다.')
            })
          }

          return (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                  <CheckSquare className="h-4 w-4 text-zinc-600" />
                  <span>체크</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-zinc-600">{doneCount}/{totalCount}</span>
                  <button
                    type="button"
                    onClick={() => setChecklistCollapsedDone((prev) => !prev)}
                    className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-600 hover:bg-zinc-50"
                  >
                    {checklistCollapsedDone ? '완료 펼치기' : '완료 접기'}
                  </button>
                </div>
              </div>
              <p className="mt-1 text-[10px] text-zinc-500">{checklistWorkDate}</p>
              <div className="mt-2 flex-1 space-y-1 overflow-auto pr-1">
                {visibleRows.map((row, index) => (
                  <div key={row.id} className="grid grid-cols-[14px_minmax(0,1fr)_16px] items-center gap-1">
                    <input
                      type="checkbox"
                      checked={row.done}
                      onChange={() => toggleDone(row.id)}
                      className="h-3.5 w-3.5 accent-sky-600"
                    />
                    <input
                      ref={(el) => {
                        checklistInputRefs.current[row.id] = el
                      }}
                      value={row.text}
                      onChange={(event) => updateText(row.id, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          createAfter(index)
                          return
                        }
                        if (event.key === 'Backspace' && row.text.trim().length === 0) {
                          event.preventDefault()
                          removeAt(index)
                        }
                      }}
                      placeholder="할 일 입력"
                      className={`h-6 rounded border border-zinc-200 px-1.5 text-[11px] outline-none focus:border-sky-300 ${
                        row.done ? 'bg-zinc-50 text-zinc-400 line-through' : 'bg-white text-zinc-800'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => removeAt(index)}
                      className="inline-flex h-4 w-4 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                      title="항목 삭제"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    createFromDraft()
                  }}
                  className="grid grid-cols-[14px_minmax(0,1fr)_16px] items-center gap-1"
                >
                  <input type="checkbox" checked={false} disabled className="h-3.5 w-3.5 accent-sky-600 opacity-40" />
                  <input
                    value={checklistDraftText}
                    onChange={(event) => setChecklistDraftText(event.target.value)}
                    placeholder="할 일 입력"
                    className="h-6 rounded border border-zinc-200 px-1.5 text-[11px] text-zinc-800 outline-none focus:border-sky-300"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-4 w-4 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                    title="항목 추가"
                  >
                    +
                  </button>
                </form>
              </div>
              <button
                type="button"
                onClick={() => {
                  const fromDateObj = new Date(`${checklistWorkDate}T00:00:00+09:00`)
                  const fromDate = new Date(fromDateObj.getTime() - 24 * 60 * 60 * 1000)
                  const fromDateIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(fromDate)
                  void carryOverAdminDashboardChecklist({
                    from_date: fromDateIso,
                    to_date: checklistWorkDate,
                    include_done: false,
                  })
                    .then(() => loadChecklistByDate())
                    .catch(() => toast.error('이월 처리에 실패했습니다.'))
                }}
                className="mt-1 rounded border border-zinc-200 px-2 py-1 text-[10px] text-zinc-600 hover:bg-zinc-50"
              >
                전일 미완료 이월
              </button>
            </div>
          )
        }
        case 'memo_widget':
          return (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                  <NotebookPen className="h-4 w-4 text-zinc-600" />
                  <span>메모</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                    글씨
                    <input
                      type="color"
                      value={memoTextColor}
                      onChange={(event) => setMemoTextColor(event.target.value)}
                      className="h-5 w-5 cursor-pointer rounded border border-zinc-300 p-0"
                      title="글씨색"
                    />
                  </label>
                  <label className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                    배경
                    <input
                      type="color"
                      value={memoBgColor}
                      onChange={(event) => setMemoBgColor(event.target.value)}
                      className="h-5 w-5 cursor-pointer rounded border border-zinc-300 p-0"
                      title="배경색"
                    />
                  </label>
                  <select
                    value={memoFontSize}
                    onChange={(event) => setMemoFontSize(Number(event.target.value))}
                    className="h-6 rounded border border-zinc-300 bg-white px-1 text-[10px] text-zinc-700"
                    title="글씨 크기"
                  >
                    <option value={12}>12</option>
                    <option value={13}>13</option>
                    <option value={14}>14</option>
                    <option value={15}>15</option>
                    <option value={16}>16</option>
                    <option value={18}>18</option>
                  </select>
                </div>
              </div>
              <textarea
                value={memoText}
                onChange={(event) => setMemoText(event.target.value)}
                placeholder="메모를 입력하세요."
                style={{
                  color: memoTextColor,
                  backgroundColor: memoBgColor,
                  fontSize: `${memoFontSize}px`,
                }}
                className="mt-2 h-full min-h-0 w-full resize-none rounded-md border border-zinc-200 px-2 py-2 text-xs outline-none focus:border-sky-300"
              />
            </div>
          )
        default:
          return (
            <div className="h-full">
              <p className="text-xs font-medium text-zinc-500">준비 중인 위젯</p>
              <p className="mt-2 text-sm text-zinc-700">{item.title}</p>
              <p className="mt-1 text-xs text-zinc-500">{item.widget_key}</p>
            </div>
          )
      }
    },
    [
      checklistCollapsedDone,
      checklistDraftText,
      checklistItems,
      checklistWorkDate,
      loadChecklistByDate,
      mailWidgetPageByTab,
      mailWidgetTab,
      mailWidgetVisibleRows,
      memoBgColor,
      memoFontSize,
      memoText,
      memoTextColor,
      router,
      handleAttendanceAction,
      attendanceSubmitting,
      widgetData,
      workPostTab,
    ]
  )

  return (
    <main className="space-y-3">
      <div className="relative pr-12">
        {loading ? (
          <div className="px-1 py-8 text-center text-sm text-zinc-500">
            위젯 레이아웃을 불러오는 중입니다.
          </div>
        ) : null}

        {!loading && error ? (
          <div className="px-1 py-4 text-sm text-rose-700">{error}</div>
        ) : null}

        {!loading && !error && visibleItems.length === 0 ? (
          <div className="px-1 py-8 text-center text-sm text-zinc-500">
            표시할 위젯이 없습니다.
          </div>
        ) : null}

        {!loading && !error && visibleItems.length > 0 ? (
          <section
            ref={gridRef}
            className={`relative grid grid-cols-12 gap-4 auto-rows-[84px] ${editMode ? 'outline outline-[1px] outline-dashed outline-zinc-300 p-1' : ''}`}
            onDragOver={(event) => {
              event.preventDefault()
            }}
            onDrop={(event) => {
              handleGridDrop(event)
            }}
            style={{
              minHeight: rowCount * ROW_HEIGHT + (rowCount - 1) * GRID_GAP,
              backgroundImage: editMode
                ? 'linear-gradient(to right, rgba(161,161,170,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(161,161,170,0.18) 1px, transparent 1px)'
                : 'none',
              backgroundSize: editMode ? `calc((100% - ${GRID_GAP * (GRID_COLS - 1)}px) / ${GRID_COLS}) ${ROW_HEIGHT + GRID_GAP}px` : 'auto',
            }}
          >
            {visibleItems.map((item) => (
              <article
                key={item.widget_id}
                className={`${CARD_BASE_CLASS} relative group ${editMode ? 'cursor-grab border-indigo-200' : ''}`}
                style={{
                  gridColumn: `${item.grid_x + 1} / span ${item.grid_w}`,
                  gridRow: `${item.grid_y + 1} / span ${item.grid_h}`,
                }}
              >
                {!editMode ? (
                  <button
                    type="button"
                    draggable={!saving}
                    onDragStart={(event) => {
                      const payload: DragPayload = { widgetKey: item.widget_key, source: 'existing' }
                      event.dataTransfer.setData('application/dashboard-widget', JSON.stringify(payload))
                      event.dataTransfer.effectAllowed = 'move'
                      const card = (event.currentTarget as HTMLElement).closest('article')
                      if (card) {
                        event.dataTransfer.setDragImage(card, 24, 16)
                      }
                    }}
                    className="absolute left-2 top-2 z-10 inline-flex h-5 w-5 cursor-grab items-center justify-center rounded border border-zinc-200 bg-white/90 text-zinc-500 opacity-0 transition hover:bg-zinc-100 group-hover:opacity-100"
                    title="위젯 위치 이동"
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {editMode ? (
                  <div
                    className="mb-2 flex cursor-grab select-none items-center gap-1"
                    draggable={!saving}
                    onDragStart={(event) => {
                      const payload: DragPayload = { widgetKey: item.widget_key, source: 'existing' }
                      event.dataTransfer.setData('application/dashboard-widget', JSON.stringify(payload))
                      event.dataTransfer.effectAllowed = 'move'
                      const card = (event.currentTarget as HTMLElement).closest('article')
                      if (card) {
                        event.dataTransfer.setDragImage(card, 24, 16)
                      }
                    }}
                  >
                    <GripVertical className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    <p className="truncate text-[11px] text-zinc-500">{item.title}</p>
                  </div>
                ) : null}
                {renderWidgetBody(item)}
              </article>
            ))}
          </section>
        ) : null}

        <aside className="absolute right-0 top-0">
          <div className="flex flex-col items-center gap-1 rounded-md border border-zinc-200 bg-white px-1 py-1">
            {headerToggleItems.map((row) => {
              const active = visibleItems.some((item) => item.widget_key === row.widget_key)
              const Icon = getWidgetHeaderIcon(row.widget_key)
              return (
                <button
                  key={row.widget_key}
                  type="button"
                  disabled={saving}
                  onClick={() => void handleHeaderToggleWidget(row.widget_key)}
                  title={`${row.title} ${active ? '숨기기' : '표시'}`}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition ${
                    active
                      ? 'border-sky-200 bg-sky-100 text-sky-700'
                      : 'border-zinc-200 bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              )
            })}
          </div>
        </aside>
      </div>
    </main>
  )
}
