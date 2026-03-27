'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import BackButton from '@/components/common/BackButton'
import PortalNotificationBell from '@/components/common/PortalNotificationBell'
import UiButton from '@/components/common/UiButton'
import {
  checkInAdmin,
  checkOutAdmin,
  getAttendanceLogs,
} from '@/services/admin/attendanceLogService'
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

const Header = () => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { session } = useAdminSessionContext()
  const [checkInTime, setCheckInTime] = useState<string | null>(null)
  const [checkOutTime, setCheckOutTime] = useState<string | null>(null)
  const [isProfileImageBroken, setIsProfileImageBroken] = useState(false)
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
  const roleName = (session as any)?.role_name ?? (session as any)?.role?.name ?? ''
  const companyName = (session as any)?.client?.company_name ?? ''
  const profileImageUrl =
    (session as any)?.profile_image_url ??
    (session as any)?.profileImageUrl ??
    null
  const resolvedProfileImageUrl = !isProfileImageBroken ? profileImageUrl : null
  const profileInitial = (session?.name || '?').trim().charAt(0) || '?'

  const currentLabel = useMemo(() => {
    const companyNameFromQuery = searchParams.get('company_name')?.trim()
    const isCompanyDetailPath = /^\/admin\/companies\/\d+$/.test(pathname)
    if (isCompanyDetailPath) {
      return companyNameFromQuery
        ? `업무 > 기본관리 > ${companyNameFromQuery}`
        : '업무 > 기본관리 > 상세'
    }
    if (pathname.startsWith('/admin/companies')) return '업무 > 기본관리'
    if (pathname.startsWith('/admin/workflow/board/materials')) return '업무 > 업무보드 > 업무자료함'
    if (pathname.startsWith('/admin/workflow/board')) return '업무 > 업무보드'
    if (pathname.startsWith('/admin/company-withholding')) return '업무 > 원천세관리'
    if (pathname.startsWith('/admin/mail/inbox')) return '메일 > 메일함'
    if (pathname.startsWith('/admin/mail/compose')) return '메일 > 메일작성'
    if (pathname.startsWith('/admin/mail/accounts')) return '메일 > 설정'
    if (pathname.startsWith('/admin/mail')) return '메일'
    if (pathname.startsWith('/admin/docs')) return '문서함'
    if (pathname.startsWith('/admin/tax-schedule')) return '업무 > 고객사 일정'
    if (pathname.startsWith('/admin/staff/my-leave')) return '인사 > 휴가/근태관리'
    if (pathname.startsWith('/admin/staff/documents/new')) return '인사 > 전자문서'
    if (pathname.startsWith('/admin/staff/documents')) return '인사 > 전자문서'
    if (pathname.startsWith('/admin/staff/attendance')) return '인사 > 휴가/근태관리'
    if (pathname.startsWith('/admin/staff/account')) return '인사 > 비밀번호 관리'
    if (pathname.startsWith('/admin/staff')) return '인사'
    if (pathname.startsWith('/admin/blog')) return '블로그'
    if (pathname.startsWith('/admin/gpt')) return 'GPT'
    if (pathname.startsWith('/admin/setting')) return '설정'
    if (pathname.startsWith('/admin/dashboard')) return '대시보드'
    return '어드민'
  }, [pathname, searchParams])

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

  useEffect(() => {
    setIsProfileImageBroken(false)
  }, [profileImageUrl])

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
      const res = await getAttendanceLogs({
        date_from: todayKst,
        date_to: todayKst,
        limit: 1,
        offset: 0,
      })
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
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-sky-50/70 backdrop-blur">
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
            <div className="hidden items-center gap-2.5 text-xs lg:flex">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-600">
                {resolvedProfileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolvedProfileImageUrl}
                    alt="프로필 이미지"
                    className="h-full w-full object-cover"
                    onError={() => setIsProfileImageBroken(true)}
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
              size="sm"
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
