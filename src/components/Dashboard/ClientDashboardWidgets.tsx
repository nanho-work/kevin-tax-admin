'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Settings } from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  getClientDashboardWidgetCatalog,
  getClientDashboardWidgetLayout,
  resetClientDashboardWidgetLayout,
  saveClientDashboardWidgetLayout,
} from '@/services/client/clientDashboardWidgetService'
import { fetchClientAnnualLeaveRequests } from '@/services/client/clientAnnualLeaveRequestService'
import { fetchClientApprovalDocuments } from '@/services/client/clientApprovalDocumentService'
import { listMailMessages } from '@/services/client/clientMailService'
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

const EXCLUDED_WIDGET_KEYS = new Set(['mail_ops_summary', 'tax_schedule_due'])
const GRID_COLS = 12
const ROW_HEIGHT = 84
const GRID_GAP = 16
const CARD_BASE_CLASS = 'rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm'

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

export default function ClientDashboardWidgets() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [layout, setLayout] = useState<DashboardUserLayoutResponse | null>(null)
  const [catalog, setCatalog] = useState<DashboardWidgetCatalogItem[]>([])
  const [widgetData, setWidgetData] = useState<ClientWidgetData>({})
  const [error, setError] = useState<string | null>(null)
  const [deviceType] = useState<DashboardDeviceType>('desktop')
  const [editMode, setEditMode] = useState(false)
  const [showControls, setShowControls] = useState(false)
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
    const sanitizedItems = sanitizeLayoutItems(filteredLayoutItems)
    const filteredCatalog = (catalogRes.items || []).filter((row) => !EXCLUDED_WIDGET_KEYS.has(row.widget_key))

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
      await resetClientDashboardWidgetLayout({ preset_id: null }, deviceType)
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
      await saveClientDashboardWidgetLayout(
        {
          replace_all: true,
          items: normalizeSortOrder(draftItems).map((item, index) => ({
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
        case 'staff_leave_pending':
          return renderSimpleCountCard('휴가 승인 대기', widgetData.staff_leave_pending, '검토 대기 신청')
        case 'approval_pending':
          return renderSimpleCountCard('결재 대기', widgetData.approval_pending, '내 결재 순서 문서')
        case 'mail_unread':
          return renderSimpleCountCard('미확인 메일', widgetData.mail_unread, '읽지 않은 메일')
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
    [widgetData]
  )

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">대시보드</h1>
          <p className="mt-1 text-xs text-zinc-500">
            {editMode ? '위젯을 드래그해서 원하는 칸에 배치하세요.' : '위젯 기반 요약 화면'}
          </p>
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
        <section className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
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
          className={`relative grid grid-cols-12 gap-4 auto-rows-[84px] ${editMode ? 'rounded-xl border border-dashed border-zinc-300 bg-zinc-50/70 p-3' : ''}`}
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
    </section>
  )
}
