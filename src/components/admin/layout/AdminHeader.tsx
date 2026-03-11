'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import BackButton from '@/components/common/BackButton'
import PortalNotificationBell from '@/components/common/PortalNotificationBell'
import UiButton from '@/components/common/UiButton'
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
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)
  const isAdminMailInbox = pathname.startsWith('/admin/mail/inbox')

  const currentLabel = useMemo(() => {
    if (pathname.startsWith('/admin/companies')) return '외부업무 > 기본관리'
    if (pathname.startsWith('/admin/company-withholding')) return '외부업무 > 원천세관리'
    if (pathname.startsWith('/admin/mail/inbox')) return '메일 > 메일함'
    if (pathname.startsWith('/admin/mail/compose')) return '메일 > 메일작성'
    if (pathname.startsWith('/admin/mail/accounts')) return '메일 > 설정'
    if (pathname.startsWith('/admin/mail')) return '메일'
    if (pathname.startsWith('/admin/tax-schedule')) return '외부업무 > 고객사 일정'
    if (pathname.startsWith('/admin/staff/my-leave')) return '내부업무 > 내휴가관리'
    if (pathname.startsWith('/admin/staff/documents/new')) return '내부업무 > 문서작성'
    if (pathname.startsWith('/admin/staff/documents')) return '내부업무 > 내 결재문서'
    if (pathname.startsWith('/admin/staff/attendance')) return '내부업무 > 출퇴근 관리'
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

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/85 backdrop-blur">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-neutral-900">KEVIN TAX ADMIN</div>
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
                <input
                  className={`${uiHeaderInputClass} w-56`}
                  value={headerKeyword}
                  onChange={(e) => setHeaderKeyword(e.target.value)}
                  placeholder="제목/발신자/본문 검색"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      replaceHeaderSearch({ keyword: headerKeyword })
                    }
                  }}
                />
              </>
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
