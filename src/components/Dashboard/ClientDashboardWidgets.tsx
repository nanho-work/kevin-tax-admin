'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CalendarCheck2, CheckSquare, FileText, GripVertical, ListTodo, Mail, NotebookPen, Trash2, UserCheck2, Users } from 'lucide-react'
import { toast } from 'react-hot-toast'
import Pagination from '@/components/common/Pagination'
import {
  getClientDashboardWidgetCatalog,
  getClientDashboardWidgetLayout,
  saveClientDashboardWidgetLayout,
} from '@/services/client/clientDashboardWidgetService'
import {
  carryOverClientDashboardChecklist,
  createClientDashboardChecklistItem,
  deleteClientDashboardChecklistItem,
  getClientDashboardChecklistByDate,
  patchClientDashboardChecklistItem,
} from '@/services/client/dashboardChecklistService'
import type { DashboardChecklistItemOut } from '@/types/dashboardChecklist'
import { getClientDashboardNote, patchClientDashboardNote } from '@/services/client/dashboardNoteService'
import { fetchClientAnnualLeaveRequests } from '@/services/client/clientAnnualLeaveRequestService'
import { fetchClientApprovalDocuments } from '@/services/client/clientApprovalDocumentService'
import { listMailAccounts, listMailMessages } from '@/services/client/clientMailService'
import { fetchClientNotificationUnreadCount } from '@/services/client/clientNotificationService'
import { getClientStaffAttendanceBoard } from '@/services/client/clientStaffService'
import { fetchClientStaffSignupRequests } from '@/services/client/clientStaffSignupRequestService'
import { fetchClientWorkPosts } from '@/services/client/clientWorkPostService'
import type {
  DashboardDeviceType,
  DashboardUserLayoutItem,
  DashboardUserLayoutResponse,
  DashboardWidgetCatalogItem,
} from '@/types/dashboardWidget'

type StaffWeeklySummary = {
  adminId: number
  name: string
  workedMinutes: number
}

type ClientWidgetData = {
  staff_leave_pending?: number
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
  staff_signup_pending?: number
  work_post_inbox?: number
  staff_attendance_week?: {
    staffTotal: number
    periodLabel: string
    rows: StaffWeeklySummary[]
  }
}

type DragPayload = {
  widgetKey: string
  source: 'existing' | 'catalog'
}

type ChecklistItem = {
  id: number
  text: string
  done: boolean
  sortOrder: number
}

const EXCLUDED_WIDGET_KEYS = new Set(['mail_ops_summary', 'tax_schedule_due'])
const HEADER_WIDGET_ORDER = [
  'staff_leave_pending',
  'approval_pending',
  'mail_unread',
  'notification_unread',
  'staff_signup_pending',
  'work_post_inbox',
  'staff_attendance_week',
  'checklist_widget',
  'memo_widget',
] as const
const GRID_COLS = 12
const ROW_HEIGHT = 84
const GRID_GAP = 16
const CARD_BASE_CLASS = 'rounded-md border border-zinc-200 bg-white px-4 py-3 shadow-sm'
const CLIENT_LOCAL_LAYOUT_STORAGE_KEY = 'client-dashboard-unmanaged-layout-v1'
const CLIENT_LOCAL_FALLBACK_WIDGETS: DashboardWidgetCatalogItem[] = [
  {
    widget_id: -2001,
    widget_key: 'memo_widget',
    title: '메모장',
    description: '개인 메모를 기록합니다',
    required_permission_code: null,
    default_w: 2,
    default_h: 4,
    min_w: 2,
    min_h: 4,
    max_w: 2,
    max_h: 4,
    supports_mobile: true,
  },
  {
    widget_id: -2002,
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

function withClientFallbackCatalog(items: DashboardWidgetCatalogItem[]): DashboardWidgetCatalogItem[] {
  const map = new Map(items.map((item) => [item.widget_key, item]))
  for (const fallback of CLIENT_LOCAL_FALLBACK_WIDGETS) {
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
    const raw = window.localStorage.getItem(CLIENT_LOCAL_LAYOUT_STORAGE_KEY)
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
    window.localStorage.removeItem(CLIENT_LOCAL_LAYOUT_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(CLIENT_LOCAL_LAYOUT_STORAGE_KEY, JSON.stringify(map))
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
    case 'staff_leave_pending':
      return CalendarCheck2
    case 'approval_pending':
      return CheckSquare
    case 'mail_unread':
      return Mail
    case 'notification_unread':
      return Bell
    case 'staff_signup_pending':
      return UserCheck2
    case 'work_post_inbox':
      return FileText
    case 'staff_attendance_week':
      return Users
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

export default function ClientDashboardWidgets() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [layout, setLayout] = useState<DashboardUserLayoutResponse | null>(null)
  const [catalog, setCatalog] = useState<DashboardWidgetCatalogItem[]>([])
  const [widgetData, setWidgetData] = useState<ClientWidgetData>({})
  const [error, setError] = useState<string | null>(null)
  const [deviceType] = useState<DashboardDeviceType>('desktop')
  const [mailWidgetTab, setMailWidgetTab] = useState<'company' | 'personal'>('company')
  const [mailWidgetPageByTab, setMailWidgetPageByTab] = useState<{ company: number; personal: number }>({
    company: 1,
    personal: 1,
  })
  const [mailWidgetVisibleRows] = useState(5)
  const [memoText, setMemoText] = useState('')
  const [memoTextColor, setMemoTextColor] = useState('#111827')
  const [memoBgColor, setMemoBgColor] = useState('#FFF9C4')
  const [memoFontSize, setMemoFontSize] = useState(14)
  const [memoInitialized, setMemoInitialized] = useState(false)
  const [checklistWorkDate] = useState(getKstDateString())
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([])
  const [checklistCollapsedDone, setChecklistCollapsedDone] = useState(false)
  const [checklistDraftText, setChecklistDraftText] = useState('')
  const gridRef = useRef<HTMLElement | null>(null)
  const mailWidgetListWrapRef = useRef<HTMLDivElement | null>(null)
  const checklistInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const [checklistPendingFocusId, setChecklistPendingFocusId] = useState<number | null>(null)
  const memoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const memoLastSavedSignatureRef = useRef('')
  const checklistTextSaveTimersRef = useRef<Record<number, ReturnType<typeof setTimeout> | undefined>>({})

  useEffect(() => {
    let mounted = true
    getClientDashboardNote()
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
      void patchClientDashboardNote(payload)
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
      const checklist = await getClientDashboardChecklistByDate(checklistWorkDate)
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
      // keep empty state
    }
  }, [checklistWorkDate])

  useEffect(() => {
    void loadChecklistByDate()
  }, [loadChecklistByDate])

  const visibleItems = useMemo(() => {
    if (!layout) return [] as DashboardUserLayoutItem[]
    return layout.items
      .filter((item) => item.visible && !EXCLUDED_WIDGET_KEYS.has(item.widget_key))
      .sort((a, b) => (a.sort_order - b.sort_order) || a.widget_id - b.widget_id)
  }, [layout])

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
    const nextData: ClientWidgetData = {}
    const jobs: Array<Promise<void>> = []

    if (keys.has('staff_leave_pending')) {
      jobs.push(
        fetchClientAnnualLeaveRequests({ status: 'pending', offset: 0, limit: 1 })
          .then((res) => {
            nextData.staff_leave_pending = Number(res.total || 0)
          })
          .catch(() => {
            nextData.staff_leave_pending = 0
          })
      )
    }

    if (keys.has('approval_pending')) {
      jobs.push(
        fetchClientApprovalDocuments({ only_my_pending: true, offset: 0, limit: 1 })
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
                  return {
                    total: 0,
                    items: [] as Array<{
                      id: number
                      mailAccountId: number
                      sender: string
                      subject: string
                      receivedAt: string | null
                      sortAt: string | null
                    }>,
                  }
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
        })().catch(() => {
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
        fetchClientNotificationUnreadCount()
          .then((count) => {
            nextData.notification_unread = Number(count || 0)
          })
          .catch(() => {
            nextData.notification_unread = 0
          })
      )
    }

    if (keys.has('staff_signup_pending')) {
      jobs.push(
        fetchClientStaffSignupRequests('pending')
          .then((res) => {
            nextData.staff_signup_pending = Number(res.total || 0)
          })
          .catch(() => {
            nextData.staff_signup_pending = 0
          })
      )
    }

    if (keys.has('work_post_inbox')) {
      jobs.push(
        fetchClientWorkPosts({ page: 1, size: 1, status: 'published' })
          .then((res) => {
            nextData.work_post_inbox = Number(res.total || 0)
          })
          .catch(() => {
            nextData.work_post_inbox = 0
          })
      )
    }

    if (keys.has('staff_attendance_week')) {
      jobs.push(
        getClientStaffAttendanceBoard({ period: 'week', offset: 0, limit: 10 })
          .then((res) => {
            const periodLabel = `${res.date_from} ~ ${res.date_to}`
            const rows = (res.items || []).slice(0, 5).map((item) => ({
              adminId: item.admin_id,
              name: item.admin_name,
              workedMinutes: (item.days || []).reduce((sum, day) => sum + (Number(day.worked_minutes) || 0), 0),
            }))
            nextData.staff_attendance_week = {
              staffTotal: Number(res.staff_total || 0),
              periodLabel,
              rows,
            }
          })
          .catch(() => {
            nextData.staff_attendance_week = {
              staffTotal: 0,
              periodLabel: '-',
              rows: [],
            }
          })
      )
    }

    await Promise.all(jobs)
    setWidgetData(nextData)
  }, [])

  const loadDashboard = useCallback(async () => {
    setError(null)
    const [layoutRes, catalogRes] = await Promise.all([
      getClientDashboardWidgetLayout(deviceType),
      getClientDashboardWidgetCatalog(),
    ])
    const filteredLayoutItems = (layoutRes.items || [])
      .filter((item) => item.visible && !EXCLUDED_WIDGET_KEYS.has(item.widget_key))
      .sort((a, b) => (a.sort_order - b.sort_order) || a.widget_id - b.widget_id)

    const filteredCatalog = withClientFallbackCatalog(
      (catalogRes.items || []).filter((row) => !EXCLUDED_WIDGET_KEYS.has(row.widget_key))
    )

    let mergedItems = filteredLayoutItems
    for (const widgetMeta of CLIENT_LOCAL_FALLBACK_WIDGETS) {
      const hasWidget = mergedItems.some((item) => item.widget_key === widgetMeta.widget_key)
      if (hasWidget) continue
      const pos = findAutoGridPosition(mergedItems, widgetMeta.default_w, widgetMeta.default_h)
      mergedItems = [
        ...mergedItems,
        {
          widget_id: widgetMeta.widget_id,
          widget_key: widgetMeta.widget_key,
          title: widgetMeta.title,
          description: widgetMeta.description,
          required_permission_code: widgetMeta.required_permission_code,
          grid_x: pos.x,
          grid_y: pos.y,
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

    const sanitizedItems = sanitizeLayoutItems(applyLocalUnmanagedLayout(mergedItems))

    setLayout({ ...layoutRes, items: sanitizedItems })
    setCatalog(filteredCatalog)
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

  const handlePersistLayoutItems = useCallback(
    async (items: DashboardUserLayoutItem[], silent: boolean) => {
      if (items.length === 0) return
      setSaving(true)
      try {
        const normalizedItems = normalizeSortOrder(items)
        writeLocalUnmanagedLayout(buildLocalUnmanagedLayout(normalizedItems))
        await saveClientDashboardWidgetLayout(
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

    if (payload.source !== 'existing') return
    const sourceItems = (layout?.items || [])
      .filter((item) => item.visible && !EXCLUDED_WIDGET_KEYS.has(item.widget_key))
      .sort((a, b) => (a.sort_order - b.sort_order) || a.widget_id - b.widget_id)
    if (sourceItems.length === 0) return
    const nextItems = buildDroppedItems(sourceItems, payload, targetX, targetY)
    setLayout((prev) => (prev ? { ...prev, items: nextItems } : prev))
    void handlePersistLayoutItems(nextItems, true)
  }, [buildDroppedItems, handlePersistLayoutItems, layout?.items])

  const handleHeaderToggleWidget = useCallback((widgetKey: string) => {
    const applyToggle = (items: DashboardUserLayoutItem[]) => {
      const exists = items.some((item) => item.widget_key === widgetKey)
      if (exists) {
        return sanitizeLayoutItems(items.filter((item) => item.widget_key !== widgetKey))
      }
      const meta = catalogByKey.get(widgetKey)
      if (!meta) return items
      const width = Math.max(1, meta.default_w || meta.min_w || 1)
      const height = Math.max(1, meta.default_h || meta.min_h || 1)
      let pos = { x: 0, y: 0 }
      const occupied = items.map((item) => ({
        x1: item.grid_x,
        y1: item.grid_y,
        x2: item.grid_x + item.grid_w,
        y2: item.grid_y + item.grid_h,
      }))
      outer: for (let y = 0; y < 200; y += 1) {
        for (let x = 0; x <= GRID_COLS - width; x += 1) {
          const x2 = x + width
          const y2 = y + height
          const collided = occupied.some((box) => !(x2 <= box.x1 || box.x2 <= x || y2 <= box.y1 || box.y2 <= y))
          if (!collided) {
            pos = { x, y }
            break outer
          }
        }
      }

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
      return sanitizeLayoutItems([...items, appended])
    }

    const sourceItems = (layout?.items || [])
      .filter((item) => item.visible && !EXCLUDED_WIDGET_KEYS.has(item.widget_key))
      .sort((a, b) => (a.sort_order - b.sort_order) || a.widget_id - b.widget_id)
    const nextItems = applyToggle(sourceItems)
    setLayout((prev) => (prev ? { ...prev, items: nextItems } : prev))
    void handlePersistLayoutItems(nextItems, true)
  }, [catalogByKey, handlePersistLayoutItems, layout?.items])

  const renderWidgetBody = useCallback(
    (item: DashboardUserLayoutItem) => {
      switch (item.widget_key) {
        case 'staff_leave_pending':
          return renderSimpleCountCard('휴가 승인 대기', widgetData.staff_leave_pending, '검토 대기 신청')
        case 'approval_pending':
          return renderSimpleCountCard('결재 대기', widgetData.approval_pending, '내 결재 순서 문서')
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
          const visibleRows = activeItems.slice(start, start + pageSize)

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
                      {visibleRows.map((row) => (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => router.push(`/client/mail/inbox?mailbox=all&account_id=${row.mailAccountId}&message_id=${row.id}`)}
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
        case 'staff_signup_pending':
          return renderSimpleCountCard('직원 가입신청 대기', widgetData.staff_signup_pending, '승인/반려 필요')
        case 'work_post_inbox':
          return renderSimpleCountCard('공지/업무지시', widgetData.work_post_inbox, '게시된 문서 수')
        case 'staff_attendance_week': {
          const board = widgetData.staff_attendance_week
          return (
            <div className="h-full">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500">직원 주간 근태</p>
                <span className="text-xs text-zinc-500">총 {Number(board?.staffTotal || 0).toLocaleString('ko-KR')}명</span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{board?.periodLabel || '-'}</p>
              <div className="mt-2 space-y-1">
                {(board?.rows || []).map((row) => (
                  <div key={row.adminId} className="flex items-center justify-between rounded-md bg-zinc-50 px-2 py-1.5">
                    <p className="text-xs text-zinc-700">{row.name}</p>
                    <p className="text-xs font-medium text-zinc-900">{Math.floor(row.workedMinutes / 60)}h {row.workedMinutes % 60}m</p>
                  </div>
                ))}
                {(board?.rows || []).length === 0 ? <p className="text-xs text-zinc-500">표시할 근태 데이터가 없습니다.</p> : null}
              </div>
            </div>
          )
        }
        case 'checklist_widget': {
          const activeItems = checklistItems.filter((row) => row.text.trim().length > 0)
          const doneCount = activeItems.filter((row) => row.done).length
          const totalCount = activeItems.length
          const visibleRows = checklistItems.filter((row) => !(checklistCollapsedDone && row.done))

          const createFromDraft = () => {
            const content = checklistDraftText.trim()
            if (!content) return
            void createClientDashboardChecklistItem({
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
            void createClientDashboardChecklistItem({
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
            void deleteClientDashboardChecklistItem(target.id)
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
              const row = checklistItems.find((entry) => entry.id === targetId)
              const sortOrder = row?.sortOrder ?? 0
              if (text.trim().length === 0) return
              void patchClientDashboardChecklistItem(targetId, {
                content: text,
                sort_order: sortOrder,
              }).catch(() => {
                // silent autosave failure
              })
            }, 350)
          }

          const toggleDone = (targetId: number) => {
            const row = checklistItems.find((entry) => entry.id === targetId)
            const nextDone = !Boolean(row?.done)
            setChecklistItems((prev) => prev.map((entry) => (entry.id === targetId ? { ...entry, done: nextDone } : entry)))
            void patchClientDashboardChecklistItem(targetId, {
              is_done: nextDone,
              sort_order: row?.sortOrder ?? 0,
            }).catch(() => {
              toast.error('체크 상태 저장에 실패했습니다.')
            })
          }

          return (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500">오늘 체크리스트</p>
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
                  void carryOverClientDashboardChecklist({
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
                <p className="text-xs font-medium text-zinc-500">메모장</p>
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
      widgetData,
    ]
  )

  return (
    <section className="space-y-4">
      <div className="relative pr-12">
        {loading ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
            위젯 레이아웃을 불러오는 중입니다.
          </div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">{error}</div>
        ) : null}

        {!loading && !error && visibleItems.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
            표시할 위젯이 없습니다.
          </div>
        ) : null}

        {!loading && !error && visibleItems.length > 0 ? (
          <section
            ref={gridRef}
            className="relative grid grid-cols-12 gap-4 auto-rows-[84px]"
            onDragOver={(event) => {
              event.preventDefault()
            }}
            onDrop={(event) => {
              handleGridDrop(event)
            }}
            style={{
              minHeight: rowCount * ROW_HEIGHT + (rowCount - 1) * GRID_GAP,
            }}
          >
            {visibleItems.map((item) => (
              <article
                key={item.widget_id}
                className={`${CARD_BASE_CLASS} relative group`}
                style={{
                  gridColumn: `${item.grid_x + 1} / span ${item.grid_w}`,
                  gridRow: `${item.grid_y + 1} / span ${item.grid_h}`,
                }}
              >
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
    </section>
  )
}
