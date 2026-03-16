'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings } from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  getAdminDashboardWidgetCatalog,
  getAdminDashboardWidgetLayout,
  resetAdminDashboardWidgetLayout,
  saveAdminDashboardWidgetLayout,
} from '@/services/admin/dashboardWidgetService'
import { getAttendanceLogs } from '@/services/admin/attendanceLogService'
import { fetchAnnualLeaves } from '@/services/admin/annualLeaveService'
import { fetchMyApprovalDocuments } from '@/services/admin/approvalDocumentService'
import { listMailMessages } from '@/services/admin/mailService'
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
import { formatKSTDateTimeAssumeUTC } from '@/utils/dateTime'

type AdminWidgetData = {
  my_attendance?: {
    checkIn: string | null
    checkOut: string | null
    date: string | null
  }
  my_leave_balance?: {
    granted: number
    consumed: number
    remaining: number
  }
  approval_pending?: number
  mail_unread?: number
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

const EXCLUDED_WIDGET_KEYS = new Set(['mail_ops_summary', 'tax_schedule_due'])
const GRID_COLS = 12
const ROW_HEIGHT = 84
const GRID_GAP = 16
const CARD_BASE_CLASS = 'rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm'
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

function renderSimpleCountCard(title: string, count?: number, subtitle?: string) {
  return (
    <div className="h-full">
      <p className="text-xs font-medium text-zinc-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-zinc-900">{(count ?? 0).toLocaleString('ko-KR')}</p>
      {subtitle ? <p className="mt-1 text-xs text-zinc-500">{subtitle}</p> : null}
    </div>
  )
}

export default function AdminDashboardWidgets() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [layout, setLayout] = useState<DashboardUserLayoutResponse | null>(null)
  const [catalog, setCatalog] = useState<DashboardWidgetCatalogItem[]>([])
  const [widgetData, setWidgetData] = useState<AdminWidgetData>({})
  const [error, setError] = useState<string | null>(null)
  const [deviceType] = useState<DashboardDeviceType>('desktop')
  const [editMode, setEditMode] = useState(false)
  const [showControls, setShowControls] = useState(false)
  const [workPostTab, setWorkPostTab] = useState<'notice' | 'task'>('notice')
  const [draftItems, setDraftItems] = useState<DashboardUserLayoutItem[]>([])
  const gridRef = useRef<HTMLElement | null>(null)

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

  const availableCatalogItems = useMemo(() => {
    const selected = new Set(draftItems.map((item) => item.widget_key))
    return catalog.filter((row) => !selected.has(row.widget_key))
  }, [catalog, draftItems])

  const rowCount = useMemo(() => {
    const maxBottom = visibleItems.reduce((acc, item) => Math.max(acc, item.grid_y + item.grid_h), 0)
    return Math.max(8, maxBottom + 2)
  }, [visibleItems])

  const loadWidgetData = useCallback(async (items: DashboardUserLayoutItem[]) => {
    const keys = new Set(items.map((item) => item.widget_key))
    const nextData: AdminWidgetData = {}
    const jobs: Array<Promise<void>> = []

    if (keys.has('my_attendance')) {
      jobs.push(
        getAttendanceLogs({ offset: 0, limit: 1, date_to: getKstDateString() })
          .then((res) => {
            const row = res.items?.[0]
            nextData.my_attendance = {
              checkIn: row?.check_in ?? null,
              checkOut: row?.check_out ?? null,
              date: row?.date ?? null,
            }
          })
          .catch(() => {
            nextData.my_attendance = { checkIn: null, checkOut: null, date: null }
          })
      )
    }

    if (keys.has('my_leave_balance')) {
      jobs.push(
        fetchAnnualLeaves({ offset: 0, limit: 100 })
          .then((res) => {
            const granted = (res.items || []).reduce((acc, item) => acc + (Number(item.granted_days) || 0), 0)
            const consumed = (res.items || []).reduce((acc, item) => acc + (Number(item.consumed_days) || 0), 0)
            const remaining = (res.items || []).reduce((acc, item) => acc + (Number(item.remaining_days) || 0), 0)
            nextData.my_leave_balance = { granted, consumed, remaining }
          })
          .catch(() => {
            nextData.my_leave_balance = { granted: 0, consumed: 0, remaining: 0 }
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
        listMailMessages({ page: 1, size: 1, is_read: false })
          .then((res) => {
            nextData.mail_unread = Number(res.total || 0)
          })
          .catch(() => {
            nextData.mail_unread = 0
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

    const sanitizedItems = sanitizeLayoutItems(applyLocalUnmanagedLayout(mergedItems))
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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await loadDashboard()
    } catch {
      toast.error('위젯 새로고침에 실패했습니다.')
    } finally {
      setRefreshing(false)
    }
  }, [loadDashboard])

  const handleReset = useCallback(async () => {
    try {
      await resetAdminDashboardWidgetLayout({ preset_id: null }, deviceType)
      writeLocalUnmanagedLayout({})
      toast.success('대시보드 레이아웃을 초기화했습니다.')
      setEditMode(false)
      await handleRefresh()
    } catch {
      toast.error('레이아웃 초기화에 실패했습니다.')
    }
  }, [deviceType, handleRefresh])

  const handleDropToCell = useCallback((payload: DragPayload, targetX: number, targetY: number) => {
    setDraftItems((prev) => {
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
    })
  }, [catalogByKey])

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

    handleDropToCell(payload, targetX, targetY)
  }, [handleDropToCell])

  const handleSaveLayout = useCallback(async () => {
    if (draftItems.length === 0) {
      toast.error('최소 1개 이상의 위젯이 필요합니다.')
      return
    }

    setSaving(true)
    try {
      const normalizedItems = normalizeSortOrder(draftItems)
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
      toast.success('대시보드 레이아웃을 저장했습니다.')
      setEditMode(false)
      setShowControls(false)
      await handleRefresh()
    } catch {
      toast.error('레이아웃 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }, [deviceType, draftItems, handleRefresh])

  const handleRemoveWidget = useCallback((widgetKey: string) => {
    setDraftItems((prev) => normalizeSortOrder(prev.filter((item) => item.widget_key !== widgetKey)))
  }, [])

  const renderWidgetBody = useCallback(
    (item: DashboardUserLayoutItem) => {
      switch (item.widget_key) {
        case 'my_attendance': {
          const data = widgetData.my_attendance
          return (
            <div className="h-full">
              <p className="text-xs font-medium text-zinc-500">오늘 출퇴근</p>
              <div className="mt-2 space-y-1 text-sm text-zinc-800">
                <p>출근: {formatKSTDateTimeAssumeUTC(data?.checkIn, '-')}</p>
                <p>퇴근: {formatKSTDateTimeAssumeUTC(data?.checkOut, '-')}</p>
              </div>
              <p className="mt-2 text-xs text-zinc-500">기준일: {data?.date || getKstDateString()}</p>
            </div>
          )
        }
        case 'my_leave_balance': {
          const data = widgetData.my_leave_balance
          return (
            <div className="h-full">
              <p className="text-xs font-medium text-zinc-500">내 연차 요약</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-zinc-50 px-2 py-2">
                  <p className="text-[11px] text-zinc-500">부여</p>
                  <p className="text-lg font-semibold text-zinc-900">{Number(data?.granted || 0).toLocaleString('ko-KR')}</p>
                </div>
                <div className="rounded-md bg-zinc-50 px-2 py-2">
                  <p className="text-[11px] text-zinc-500">사용</p>
                  <p className="text-lg font-semibold text-zinc-900">{Number(data?.consumed || 0).toLocaleString('ko-KR')}</p>
                </div>
                <div className="rounded-md bg-zinc-50 px-2 py-2">
                  <p className="text-[11px] text-zinc-500">잔여</p>
                  <p className="text-lg font-semibold text-sky-700">{Number(data?.remaining || 0).toLocaleString('ko-KR')}</p>
                </div>
              </div>
            </div>
          )
        }
        case 'approval_pending':
          return renderSimpleCountCard('내 결재 대기', widgetData.approval_pending, '처리 대기 문서')
        case 'mail_unread':
          return renderSimpleCountCard('미확인 메일', widgetData.mail_unread, '읽지 않은 메일')
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
    [router, widgetData, workPostTab]
  )

  return (
    <main className="space-y-3">
      <div className="flex items-center justify-between px-1 py-1">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">대시보드</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowControls((prev) => !prev)}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-md border ${showControls || editMode ? 'border-indigo-300 text-indigo-700' : 'border-zinc-300 text-zinc-700'}`}
          aria-label="대시보드 편집 설정"
          title="대시보드 설정"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {(showControls || editMode) ? (
        <section className="flex flex-wrap items-center gap-2 px-1 py-1">
          {!editMode ? (
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="rounded-md border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700"
            >
              위젯 편집 시작
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditMode(false)
                  setDraftItems(layout?.items.filter((item) => item.visible && !EXCLUDED_WIDGET_KEYS.has(item.widget_key)) || [])
                }}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700"
              >
                편집 취소
              </button>
              <button
                type="button"
                onClick={() => void handleSaveLayout()}
                disabled={saving}
                className="rounded-md border border-emerald-300 px-3 py-1.5 text-sm text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? '저장 중...' : '레이아웃 저장'}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? '새로고침 중...' : '새로고침'}
          </button>
          <button
            type="button"
            onClick={() => void handleReset()}
            className="rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-600"
          >
            레이아웃 초기화
          </button>
        </section>
      ) : null}

      {editMode ? (
        <section className="px-1 py-1">
          <p className="text-xs font-medium text-zinc-600">위젯 선택</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {availableCatalogItems.length === 0 ? (
              <p className="text-xs text-zinc-500">추가 가능한 위젯이 없습니다.</p>
            ) : (
              availableCatalogItems.map((row) => (
                <button
                  key={row.widget_key}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    const payload: DragPayload = { widgetKey: row.widget_key, source: 'catalog' }
                    event.dataTransfer.setData('application/dashboard-widget', JSON.stringify(payload))
                    event.dataTransfer.effectAllowed = 'move'
                  }}
                  className="cursor-grab rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700"
                >
                  + {row.title}
                </button>
              ))
            )}
          </div>
        </section>
      ) : null}

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
          className={`relative grid grid-cols-12 gap-4 auto-rows-[84px] ${editMode ? 'outline outline-1 outline-dashed outline-zinc-300 p-1' : ''}`}
          onDragOver={(event) => {
            if (!editMode) return
            event.preventDefault()
          }}
          onDrop={(event) => {
            if (!editMode) return
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
              draggable={editMode}
              onDragStart={(event) => {
                if (!editMode) return
                const payload: DragPayload = { widgetKey: item.widget_key, source: 'existing' }
                event.dataTransfer.setData('application/dashboard-widget', JSON.stringify(payload))
                event.dataTransfer.effectAllowed = 'move'
              }}
              className={`${CARD_BASE_CLASS} ${editMode ? 'cursor-grab border-indigo-200' : ''}`}
              style={{
                gridColumn: `${item.grid_x + 1} / span ${item.grid_w}`,
                gridRow: `${item.grid_y + 1} / span ${item.grid_h}`,
              }}
            >
              {editMode ? (
                <div className="mb-2 flex items-center justify-between">
                  <p className="truncate text-[11px] text-zinc-500">{item.title}</p>
                  <button
                    type="button"
                    onClick={() => handleRemoveWidget(item.widget_key)}
                    className="rounded border border-rose-200 px-1.5 py-0.5 text-[10px] text-rose-600"
                  >
                    제거
                  </button>
                </div>
              ) : null}
              {renderWidgetBody(item)}
            </article>
          ))}
        </section>
      ) : null}
    </main>
  )
}
