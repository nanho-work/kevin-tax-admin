'use client'

import { Bell } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import UiButton from '@/components/common/UiButton'
import type { PortalNotificationItem, PortalNotificationListResponse } from '@/types/portalNotification'
import { formatKSTDateTimeAssumeUTC } from '@/utils/dateTime'

type Props = {
  listNotifications: (params?: { page?: number; limit?: number; status?: string }) => Promise<PortalNotificationListResponse>
  fetchUnreadCount: () => Promise<number>
  markAsRead: (receiptId: number) => Promise<void>
  markAllAsRead: () => Promise<number>
  getErrorMessage: (error: unknown) => string
  className?: string
  onUnreadCountChange?: (count: number) => void
}

function isUnreadNotificationStatus(status?: string | null, readAt?: string | null): boolean {
  const normalized = String(status || '').toLowerCase().trim()
  if (normalized === 'unread') return true
  if (normalized === 'read' || normalized === 'ack' || normalized === 'in_progress' || normalized === 'done') return false
  return !readAt
}

export default function PortalNotificationBell({
  listNotifications,
  fetchUnreadCount,
  markAsRead,
  markAllAsRead,
  getErrorMessage,
  className,
  onUnreadCountChange,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState<PortalNotificationListResponse['items']>([])
  const [loading, setLoading] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [listFilter, setListFilter] = useState<'unread' | 'read'>('unread')
  const [isBellHighlight, setIsBellHighlight] = useState(false)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const prevUnreadCountRef = useRef(0)
  const highlightTimerRef = useRef<number | null>(null)
  const portalPrefix = pathname.startsWith('/admin') ? '/admin' : pathname.startsWith('/client') ? '/client' : ''

  const withSourceQuery = useCallback(
    (
      basePath: string,
      item: PortalNotificationItem,
      sourceIdFromPath?: string | null,
      sourceTypeOverride?: string | null
    ) => {
      const params = new URLSearchParams()
      const sourceType = sourceTypeOverride || item.source_type || ''
      const sourceId = item.source_id ? String(item.source_id) : sourceIdFromPath || ''
      if (sourceType) params.set('source_type', sourceType)
      if (sourceId) params.set('source_id', sourceId)
      const query = params.toString()
      return query ? `${basePath}?${query}` : basePath
    },
    []
  )

  const resolveNotificationTarget = useCallback(
    (item: PortalNotificationItem): string | null => {
      const rawTarget = item.deeplink_url?.trim() || ''
      if (!rawTarget) {
        if (portalPrefix === '/client') {
          if (item.domain === 'approval' || item.domain === 'leave') return withSourceQuery('/client/staff/approvals/documents', item)
          if (item.domain === 'notice' || item.domain === 'task' || item.source_type === 'work_post') {
            return withSourceQuery('/client/staff/work-posts', item)
          }
          if (item.domain === 'signup') return '/client/staff/signup-requests'
          if (item.domain === 'mail') return '/client/mail/inbox'
          return '/client/dashboard'
        }
        if (portalPrefix === '/admin') {
          if (item.domain === 'approval') return withSourceQuery('/admin/staff/documents', item)
          if (item.domain === 'leave') return withSourceQuery('/admin/staff/documents', item)
          if (item.domain === 'notice' || item.domain === 'task' || item.source_type === 'work_post') {
            return withSourceQuery('/admin/staff/work-posts', item)
          }
          if (item.domain === 'mail') return '/admin/mail/inbox'
          return '/admin/dashboard'
        }
        return null
      }

      if (rawTarget.startsWith('http://') || rawTarget.startsWith('https://')) {
        try {
          const parsed = new URL(rawTarget)
          if (typeof window !== 'undefined' && parsed.origin !== window.location.origin) {
            return rawTarget
          }
          const sameOriginPath = `${parsed.pathname}${parsed.search}${parsed.hash}`
          return sameOriginPath || null
        } catch {
          return rawTarget
        }
      }

      const leaveClientMatch = rawTarget.match(/^\/client\/annual-leave-requests\/(\d+)\/?$/)
      if (leaveClientMatch) {
        return withSourceQuery('/client/staff/approvals/documents', item, leaveClientMatch[1], 'annual_leave_request')
      }
      const leaveAdminMatch = rawTarget.match(/^\/admin\/annual-leave-requests\/(\d+)\/?$/)
      if (leaveAdminMatch) {
        return withSourceQuery('/admin/staff/documents', item, leaveAdminMatch[1], 'annual_leave_request')
      }
      const approvalClientMatch = rawTarget.match(/^\/client\/approvals\/documents\/(\d+)\/?$/)
      if (approvalClientMatch) {
        return withSourceQuery('/client/staff/approvals/documents', item, approvalClientMatch[1], 'approval_document')
      }
      const approvalAdminMatch = rawTarget.match(/^\/admin\/approvals\/documents\/(\d+)\/?$/)
      if (approvalAdminMatch) {
        return withSourceQuery('/admin/staff/documents', item, approvalAdminMatch[1], 'approval_document')
      }
      const workPostRawMatch = rawTarget.match(/^\/work-posts\/(\d+)\/?$/)
      if (workPostRawMatch) {
        if (portalPrefix === '/client') return withSourceQuery('/client/staff/work-posts', item, workPostRawMatch[1], 'work_post')
        if (portalPrefix === '/admin') return withSourceQuery('/admin/staff/work-posts', item, workPostRawMatch[1], 'work_post')
      }
      const workPostClientMatch = rawTarget.match(/^\/client\/work-posts\/(\d+)\/?$/)
      if (workPostClientMatch) {
        return withSourceQuery('/client/staff/work-posts', item, workPostClientMatch[1], 'work_post')
      }
      const workPostAdminMatch = rawTarget.match(/^\/admin\/work-posts\/(\d+)\/?$/)
      if (workPostAdminMatch) {
        return withSourceQuery('/admin/staff/work-posts', item, workPostAdminMatch[1], 'work_post')
      }

      if (rawTarget.startsWith('/client/') || rawTarget.startsWith('/admin/')) {
        return rawTarget
      }
      if (rawTarget.startsWith('/')) {
        if (!portalPrefix) return rawTarget
        return `${portalPrefix}${rawTarget}`
      }
      return null
    },
    [portalPrefix, withSourceQuery]
  )

  const loadUnreadCount = useCallback(async () => {
    try {
      const count = await fetchUnreadCount()
      setUnreadCount(count)
    } catch {
      // silence
    }
  }, [fetchUnreadCount])

  const loadList = useCallback(async () => {
    try {
      setLoading(true)
      const res = await listNotifications({ page: 1, limit: 12, status: listFilter })
      const filteredItems = (res.items || []).filter((item) =>
        listFilter === 'unread'
          ? isUnreadNotificationStatus(String(item.status), item.read_at)
          : !isUnreadNotificationStatus(String(item.status), item.read_at)
      )
      setItems(filteredItems)
    } catch (error) {
      toast.error(getErrorMessage(error))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [getErrorMessage, listFilter, listNotifications])

  useEffect(() => {
    onUnreadCountChange?.(unreadCount)
  }, [onUnreadCountChange, unreadCount])

  useEffect(() => {
    const prevCount = prevUnreadCountRef.current
    const isIncreased = unreadCount > prevCount
    prevUnreadCountRef.current = unreadCount

    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = null
    }

    if (isIncreased && unreadCount > 0) {
      setIsBellHighlight(true)
      highlightTimerRef.current = window.setTimeout(() => {
        setIsBellHighlight(false)
        highlightTimerRef.current = null
      }, 2500)
      return
    }

    if (unreadCount === 0) {
      setIsBellHighlight(false)
    }
  }, [unreadCount])

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    void loadUnreadCount()
    const timer = window.setInterval(() => {
      void loadUnreadCount()
    }, 15_000)

    const handleFocus = () => {
      void loadUnreadCount()
      if (open) void loadList()
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadUnreadCount()
        if (open) void loadList()
      }
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadList, loadUnreadCount, open])

  useEffect(() => {
    if (!open) return
    void loadList()
  }, [open, loadList, listFilter])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleOpen = () => {
    setOpen((prev) => !prev)
  }

  const handleReadAll = async () => {
    try {
      setMarkingAll(true)
      const updatedCount = await markAllAsRead()
      setItems((prev) =>
        listFilter === 'unread'
          ? []
          : prev.map((item) => ({ ...item, status: 'read', read_at: item.read_at || new Date().toISOString() }))
      )
      setUnreadCount(0)
      if (updatedCount > 0) toast.success(`${updatedCount}건을 읽음 처리했습니다.`)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setMarkingAll(false)
    }
  }

  const handleClickItem = async (receiptId: number) => {
    const clickedItem = items.find((item) => item.receipt_id === receiptId)
    const wasUnread = isUnreadNotificationStatus(String(clickedItem?.status), clickedItem?.read_at)

    if (wasUnread) {
      setItems((prev) => {
        if (listFilter === 'unread') {
          return prev.filter((item) => item.receipt_id !== receiptId)
        }
        return prev.map((item) =>
          item.receipt_id === receiptId ? { ...item, status: 'read', read_at: item.read_at || new Date().toISOString() } : item
        )
      })
      setUnreadCount((prev) => Math.max(0, prev - 1))
      try {
        await markAsRead(receiptId)
      } catch {
        // silence: navigation continuity first
      }
    }

    if (!clickedItem) return
    const target = resolveNotificationTarget(clickedItem)
    if (!target) return
    setOpen(false)
    if (target.startsWith('http://') || target.startsWith('https://')) {
      window.location.href = target
      return
    }
    router.push(target)
  }

  return (
    <div ref={dropdownRef} className={`relative ${className || ''}`}>
      <UiButton
        onClick={handleOpen}
        variant="secondary"
        size="icon"
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 transition hover:bg-zinc-50 ${
          isBellHighlight ? 'animate-pulse ring-2 ring-amber-300/70' : ''
        }`}
        aria-label="알림"
      >
        <Bell size={16} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-semibold leading-4 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </UiButton>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[360px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
          <div className="border-b border-zinc-200 px-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-900">알림</p>
              <UiButton
                onClick={() => void handleReadAll()}
                disabled={markingAll || unreadCount === 0}
                size="sm"
                variant="secondary"
              >
                전체 읽음
              </UiButton>
            </div>
            <div className="mt-2 flex items-center gap-1">
              <UiButton
                onClick={() => setListFilter('unread')}
                size="sm"
                variant={listFilter === 'unread' ? 'tabActive' : 'tabInactive'}
              >
                안읽음
              </UiButton>
              <UiButton
                onClick={() => setListFilter('read')}
                size="sm"
                variant={listFilter === 'read' ? 'soft' : 'tabInactive'}
              >
                읽음
              </UiButton>
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="px-3 py-8 text-center text-sm text-zinc-500">불러오는 중...</div>
            ) : items.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-zinc-500">
                {listFilter === 'unread' ? '안읽은 알림이 없습니다.' : '읽은 알림이 없습니다.'}
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {items.map((item) => {
                  const isUnread = isUnreadNotificationStatus(String(item.status), item.read_at)
                  return (
                    <li key={item.receipt_id}>
                      <button
                        type="button"
                        onClick={() => void handleClickItem(item.receipt_id)}
                        className={`w-full px-3 py-2 text-left transition hover:bg-zinc-50 ${isUnread ? 'bg-sky-50/60' : 'bg-white'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className={`line-clamp-1 text-sm ${isUnread ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-800'}`}>
                            {item.title}
                          </p>
                          {isUnread ? <span className="h-2 w-2 rounded-full bg-sky-500" /> : null}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-zinc-600">{item.body || '-'}</p>
                        <p className="mt-1 text-[11px] text-zinc-400">{formatKSTDateTimeAssumeUTC(item.created_at)}</p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
