'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import BackButton from '@/components/common/BackButton'
import PortalNotificationBell from '@/components/common/PortalNotificationBell'
import UiButton from '@/components/common/UiButton'
import UiSearchInput from '@/components/common/UiSearchInput'
import {
  checkInAdmin,
  checkOutAdmin,
  getAttendanceLogs,
} from '@/services/admin/attendanceLogService'
import { listMailAccounts } from '@/services/admin/mailService'
import { logoutAdmin } from '@/services/admin/adminService'
import {
  fetchAdminNotificationUnreadCount,
  getAdminNotificationErrorMessage,
  listAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from '@/services/admin/notificationService'
import { clearAdminAccessToken } from '@/services/http'
import { useAdminSessionContext } from '@/contexts/AdminSessionContext'
import { filterAdminVisibleMailAccounts } from '@/utils/mailAccountScope'
import { uiHeaderInputClass } from '@/styles/uiClasses'

const Header = () => {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { session } = useAdminSessionContext()
  const [mailAccounts, setMailAccounts] = useState<Array<{ id: number; email: string }>>([])
  const [headerMailAccountId, setHeaderMailAccountId] = useState('')
  const [headerKeyword, setHeaderKeyword] = useState('')
  const [checkInTime, setCheckInTime] = useState<string | null>(null)
  const [checkOutTime, setCheckOutTime] = useState<string | null>(null)
  const [attendanceSubmitting, setAttendanceSubmitting] = useState<'check-in' | 'check-out' | null>(null)
  const [currentTime, setCurrentTime] = useState<string>(() =>
    new Date().toLocaleTimeString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  )
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)
  const isAdminMailInbox = pathname.startsWith('/admin/mail/inbox')
  const roleName = (session as any)?.role_name ?? (session as any)?.role?.name ?? ''
  const companyName = (session as any)?.client?.company_name ?? ''
  const profileImageUrl =
    (session as any)?.profile_image_url ??
    (session as any)?.profileImageUrl ??
    null
  const profileInitial = (session?.name || '?').trim().charAt(0) || '?'

  const currentLabel = useMemo(() => {
    if (pathname.startsWith('/admin/companies')) return '외부업무 > 기본관리'
    if (pathname.startsWith('/admin/company-withholding')) return '외부업무 > 원천세관리'
    if (pathname.startsWith('/admin/mail/inbox')) return '메일 > 메일함'
    if (pathname.startsWith('/admin/mail/compose')) return '메일 > 메일작성'
    if (pathname.startsWith('/admin/mail/accounts')) return '메일 > 설정'
    if (pathname.startsWith('/admin/mail')) return '메일'
    if (pathname.startsWith('/admin/tax-schedule')) return '외부업무 > 고객사 일정'
    if (pathname.startsWith('/admin/staff/my-leave')) return '내부업무 > 휴가/근태관리'
    if (pathname.startsWith('/admin/staff/documents/new')) return '내부업무 > 전자문서'
    if (pathname.startsWith('/admin/staff/documents')) return '내부업무 > 전자문서'
    if (pathname.startsWith('/admin/staff/attendance')) return '내부업무 > 휴가/근태관리'
    if (pathname.startsWith('/admin/staff/account')) return '내부업무 > 비밀번호 관리'
    if (pathname.startsWith('/admin/staff')) return '내부업무'
    if (pathname.startsWith('/admin/blog')) return '블로그'
    if (pathname.startsWith('/admin/gpt')) return 'GPT'
    if (pathname.startsWith('/admin/setting')) return '설정'
    if (pathname.startsWith('/admin/dashboard')) return '대시보드'
    return '어드민'
  }, [pathname])

  const backPath = useMemo(() => {
    if (pathname.startsWith('/admin/companies/') && pathname !== '/admin/companies/new') return '/admin/companies'
    if (pathname.startsWith('/admin/companies/new')) return '/admin/companies'
    if (pathname.startsWith('/admin/companies/account/new')) return '/admin/companies/account'
    if (
      pathname.startsWith('/admin/company-withholding/') &&
      pathname !== '/admin/company-withholding/business'
    ) {
      return '/admin/company-withholding/business'
    }
    return null
  }, [pathname])

  useEffect(() => {
    if (!isAdminMailInbox) return
    void listMailAccounts(true)
      .then((res) => {
        const visibleItems = filterAdminVisibleMailAccounts(res.items || [], session?.id)
        const items = visibleItems.map((item) => ({ id: item.id, email: item.email }))
        setMailAccounts(items)
      })
      .catch(() => {
        setMailAccounts([])
      })
  }, [isAdminMailInbox, session?.id])

  useEffect(() => {
    if (!isAdminMailInbox) return
    setHeaderMailAccountId(searchParams.get('account_id') || '')
    setHeaderKeyword(searchParams.get('q') || '')
  }, [isAdminMailInbox, searchParams])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString('ko-KR', {
          timeZone: 'Asia/Seoul',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      )
    }, 1000)
    return () => window.clearInterval(interval)
  }, [])

  const loadTodayAttendance = async () => {
    const accountId = Number((session as any)?.account_id ?? (session as any)?.id ?? 0)
    if (!accountId) {
      setCheckInTime(null)
      setCheckOutTime(null)
      return
    }

    const toHm = (value?: string | null) => {
      if (!value) return null
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return null
      return date.toLocaleTimeString('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour: '2-digit',
        minute: '2-digit',
      })
    }

    const todayKst = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())

    try {
      const res = await getAttendanceLogs({ date_to: todayKst, limit: 1, offset: 0 })
      const row = res.items?.[0]
      setCheckInTime(toHm(row?.check_in))
      setCheckOutTime(toHm(row?.check_out))
    } catch {
      setCheckInTime(null)
      setCheckOutTime(null)
    }
  }

  useEffect(() => {
    void loadTodayAttendance()
  }, [session])

  const handleManualCheckIn = async () => {
    if (attendanceSubmitting || checkInTime) return
    setAttendanceSubmitting('check-in')
    try {
      await checkInAdmin()
      await loadTodayAttendance()
    } catch (error) {
      console.warn('출근 처리 실패:', error)
    } finally {
      setAttendanceSubmitting(null)
    }
  }

  const handleManualCheckOut = async () => {
    if (attendanceSubmitting || !checkInTime || checkOutTime) return
    setAttendanceSubmitting('check-out')
    try {
      await checkOutAdmin()
      await loadTodayAttendance()
    } catch (error) {
      console.warn('퇴근 처리 실패:', error)
    } finally {
      setAttendanceSubmitting(null)
    }
  }

  const replaceHeaderSearch = (next: { accountId?: string; keyword?: string }) => {
    const params = new URLSearchParams(searchParams.toString())
    const accountId = next.accountId ?? headerMailAccountId
    const keyword = next.keyword ?? headerKeyword

    if (accountId) params.set('account_id', accountId)
    else params.delete('account_id')

    if (keyword.trim()) params.set('q', keyword.trim())
    else params.delete('q')

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logoutAdmin()
    } catch (error) {
      console.warn('로그아웃 API 호출 실패:', error)
    } finally {
      clearAdminAccessToken()
      router.replace('/login/staff')
      setLoggingOut(false)
    }
  }

  const canCheckIn = !checkInTime
  const canCheckOut = Boolean(checkInTime) && !checkOutTime

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/85 backdrop-blur">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-neutral-900">
              {companyName || 'KEVIN TAX ADMIN'}
            </div>
            {backPath ? (
              <div className="mt-1 flex items-center gap-2">
                <BackButton
                  fallbackPath={backPath}
                  className="inline-flex h-7 items-center rounded-md border border-zinc-300 px-2.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                />
                <span className="text-xs text-neutral-300">|</span>
                <span className="truncate text-xs text-neutral-500">{currentLabel}</span>
                {unreadNotificationCount > 0 ? (
                  <span className="inline-flex h-5 items-center rounded-full bg-amber-100 px-2 text-[11px] font-medium text-amber-700">
                    새 알림 {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}건
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
                <span>{currentLabel}</span>
                {unreadNotificationCount > 0 ? (
                  <span className="inline-flex h-5 items-center rounded-full bg-amber-100 px-2 text-[11px] font-medium text-amber-700">
                    새 알림 {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}건
                  </span>
                ) : null}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 pr-7">
            {isAdminMailInbox ? (
              <>
                <select
                  className={`${uiHeaderInputClass} w-56`}
                  value={headerMailAccountId}
                  onChange={(e) => {
                    const nextAccountId = e.target.value
                    setHeaderMailAccountId(nextAccountId)
                    replaceHeaderSearch({ accountId: nextAccountId })
                  }}
                >
                  <option value="">전체 계정</option>
                  {mailAccounts.map((account) => (
                    <option key={account.id} value={String(account.id)}>
                      {account.email}
                    </option>
                  ))}
                </select>
                <UiSearchInput
                  wrapperClassName={`${uiHeaderInputClass} w-56`}
                  value={headerKeyword}
                  onChange={setHeaderKeyword}
                  placeholder="제목/발신자/본문 검색"
                  onSubmit={() => replaceHeaderSearch({ keyword: headerKeyword })}
                />
              </>
            ) : null}
            <div className="hidden items-center gap-2.5 text-xs lg:flex">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-600">
                {profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileImageUrl}
                    alt="프로필 이미지"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{profileInitial}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-neutral-900">
                  {session?.name || '-'} {roleName}
                  <span className="ml-1 text-xs font-medium text-neutral-500">
                    · 현재{' '}
                    <span className="inline-block min-w-[72px] text-right tabular-nums">
                      {currentTime}
                    </span>
                  </span>
                </p>
                <p className="truncate text-neutral-500">
                  출근{' '}
                  <span className="inline-block min-w-[46px] text-right tabular-nums">
                    {checkInTime ?? '-'}
                  </span>{' '}
                  · 퇴근{' '}
                  <span className="inline-block min-w-[46px] text-right tabular-nums">
                    {checkOutTime ?? '-'}
                  </span>
                </p>
              </div>
            </div>
            {canCheckIn ? (
              <UiButton
                onClick={() => void handleManualCheckIn()}
                disabled={attendanceSubmitting !== null}
                variant="secondary"
                size="sm"
              >
                {attendanceSubmitting === 'check-in' ? '출근 처리중...' : '출근'}
              </UiButton>
            ) : null}
            {canCheckOut ? (
              <UiButton
                onClick={() => void handleManualCheckOut()}
                disabled={attendanceSubmitting !== null}
                variant="secondary"
                size="sm"
              >
                {attendanceSubmitting === 'check-out' ? '퇴근 처리중...' : '퇴근'}
              </UiButton>
            ) : null}
            <PortalNotificationBell
              listNotifications={listAdminNotifications}
              fetchUnreadCount={fetchAdminNotificationUnreadCount}
              markAsRead={markAdminNotificationRead}
              markAllAsRead={markAllAdminNotificationsRead}
              getErrorMessage={getAdminNotificationErrorMessage}
              onUnreadCountChange={setUnreadNotificationCount}
            />
            <UiButton
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              variant="secondary"
              size="md"
            >
              {loggingOut ? '로그아웃 중...' : '로그아웃'}
            </UiButton>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
