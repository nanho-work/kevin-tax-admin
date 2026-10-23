'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useHeaderBackAction } from '@/contexts/HeaderBackContext'
import BackButton from '@/components/common/BackButton'
import { getPortalBackPath } from '@/utils/portalBackNavigation'
import PortalNotificationBell from '@/components/common/PortalNotificationBell'
import HeaderActionButton from '@/components/common/HeaderActionButton'
import { LogOut } from 'lucide-react'
import { logoutClient } from '@/services/client/clientAuthService'
import {
  fetchClientNotificationUnreadCount,
  getClientNotificationErrorMessage,
  listClientNotifications,
  markAllClientNotificationsRead,
  markClientNotificationRead,
} from '@/services/client/clientNotificationService'
import { clearClientAccessToken } from '@/services/http'

type HeaderInfo = {
  parent: string
  child?: string
}

function currentHeader(pathname: string): HeaderInfo {
  if (pathname.startsWith('/client/dashboard')) return { parent: '대시보드' }
  if (pathname.startsWith('/client/docs')) return { parent: '문서함' }
  if (pathname.startsWith('/client/workflow/board/materials')) return { parent: '업무', child: '업무자료함' }
  if (pathname.startsWith('/client/workflow/board')) return { parent: '업무', child: '업무보드' }
  if (pathname.startsWith('/client/mail/inbox')) return { parent: '메일', child: '메일함' }
  if (pathname.startsWith('/client/mail/compose')) return { parent: '메일', child: '메일작성' }
  if (pathname.startsWith('/client/mail/accounts')) return { parent: '메일', child: '설정' }
  if (pathname.startsWith('/client/mail')) return { parent: '메일' }
  if (pathname.startsWith('/client/companies/bulk')) return { parent: '거래처 관리', child: '거래처 일괄등록' }
  if (pathname.startsWith('/client/companies/new')) return { parent: '거래처 관리', child: '거래처 등록' }
  if (pathname.startsWith('/client/companies/')) return { parent: '거래처 관리', child: '거래처 상세' }
  if (pathname.startsWith('/client/companies')) return { parent: '거래처 관리' }
  if (pathname.startsWith('/client/bookkeeping/contracts')) return { parent: '업무(기장)', child: '기장 고객사 관리' }
  if (pathname.startsWith('/client/bookkeeping/billings')) return { parent: '업무(기장)', child: '월별 청구/수납 관리' }
  if (pathname.startsWith('/client/bookkeeping/summary')) return { parent: '업무(기장)', child: '월별 집계' }
  if (pathname.startsWith('/client/bookkeeping/debits/history/')) return { parent: '업무(기장)', child: '업로드 이력 상세' }
  if (pathname.startsWith('/client/bookkeeping/debits/batches/')) return { parent: '업무(기장)', child: '업로드 이력 상세' }
  if (pathname.startsWith('/client/bookkeeping/debits/history')) return { parent: '업무(기장)', child: '업로드 이력' }
  if (pathname.startsWith('/client/bookkeeping/debits/upload')) return { parent: '업무(기장)', child: '자동이체 업로드' }
  if (pathname.startsWith('/client/bookkeeping/debits')) return { parent: '업무(기장)', child: '입금내역' }
  if (pathname.startsWith('/client/staff/register')) return { parent: '인사', child: '직원등록' }
  if (pathname.startsWith('/client/staff/signup-requests')) return { parent: '인사', child: '직원가입신청' }
  if (pathname.startsWith('/client/staff/profile-status')) return { parent: '인사', child: '직원정보수정/재직상태' }
  if (pathname.startsWith('/client/staff/leave')) return { parent: '인사', child: '직원 근태/휴가 관리' }
  if (pathname.startsWith('/client/staff/approvals/documents')) return { parent: '인사', child: '결재 문서 승인' }
  if (pathname.startsWith('/client/staff/approvals')) return { parent: '인사', child: '결재 문서 승인' }
  if (pathname.startsWith('/client/staff/organization')) return { parent: '인사', child: '권한/조직배치' }
  if (pathname.startsWith('/client/staff/attendance')) return { parent: '인사', child: '직원 근태/휴가 관리' }
  if (pathname.startsWith('/client/staff/account-security')) return { parent: '인사', child: '초기비밀번호 재설정/잠금해제' }
  if (pathname.startsWith('/client/staff')) return { parent: '인사', child: '직원목록/검색' }
  if (pathname.startsWith('/client/client-management/company-create')) return { parent: '클라이언트 관리', child: '클라이언트(업체) 등록' }
  if (pathname.startsWith('/client/client-management/company-list')) return { parent: '클라이언트 관리', child: '클라이언트(업체) 목록' }
  if (pathname.startsWith('/client/client-management/create')) return { parent: '클라이언트 관리', child: '클라이언트(관리자) 등록' }
  if (pathname.startsWith('/client/client-management/list')) return { parent: '클라이언트 관리', child: '클라이언트(관리자) 목록' }
  if (pathname.startsWith('/client/client-management/templates')) return { parent: '클라이언트 관리', child: '샘플양식 업로드' }
  if (pathname.startsWith('/client/client-management/expense-rate-base')) return { parent: '클라이언트 관리', child: '기준 단순 경비율 등록' }
  if (pathname.startsWith('/client/client-management/consent-terms')) return { parent: '클라이언트 관리', child: '동의약관 관리' }
  if (pathname.startsWith('/client/client-management/mail-ops-dashboard')) return { parent: '클라이언트 관리', child: '메일운영대시보드' }
  if (pathname.startsWith('/client/client-management/gpt')) return { parent: '클라이언트 관리', child: 'GPT' }
  if (pathname.startsWith('/client/client-management/blog/create')) return { parent: '클라이언트 관리', child: '블로그 작성' }
  if (pathname.startsWith('/client/client-management/blog/list')) return { parent: '클라이언트 관리', child: '블로그 목록' }
  if (pathname.startsWith('/client/client-management/blog/')) return { parent: '클라이언트 관리', child: '블로그 상세' }
  if (pathname.startsWith('/client/client-management')) return { parent: '클라이언트 관리' }
  if (pathname.startsWith('/client/setting/account')) return { parent: '내 정보', child: '비밀번호 변경' }
  if (pathname.startsWith('/client/setting/subscription')) return { parent: '내 정보', child: '요금제/구독' }
  if (pathname.startsWith('/client/setting/security')) return { parent: '내 정보', child: '로그/보안' }
  if (pathname.startsWith('/client/setting')) return { parent: '내 정보' }
  if (pathname.startsWith('/client/schedule')) return { parent: '거래처 관리', child: '거래처 일정' }
  return { parent: '클라이언트' }
}

export default function ClientHeader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { parent, child } = currentHeader(pathname)
  const title = child ? `${parent} > ${child}` : parent
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)
  const localBack = useHeaderBackAction()
  const backPath = getPortalBackPath(pathname, searchParams)

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logoutClient()
    } finally {
      clearClientAccessToken()
      router.replace('/login/master/login')
      setLoggingOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-sky-50/70 backdrop-blur">
      <div className="px-4 py-3">
        <div className="grid grid-cols-[1fr_auto] items-stretch gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {backPath || localBack ? <BackButton fallbackPath={backPath || pathname} onBack={localBack ?? undefined} iconOnly /> : null}
            <div className="min-w-0">
            {backPath ? (
              <div className="flex items-center gap-2">
                <div className="truncate text-sm font-semibold text-neutral-900">{title}</div>
                {unreadNotificationCount > 0 ? (
                  <span className="inline-flex h-5 items-center rounded-full bg-amber-100 px-2 text-[11px] font-medium text-amber-700">
                    새 알림 {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}건
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-neutral-900">{title}</span>
                {unreadNotificationCount > 0 ? (
                  <span className="inline-flex h-5 items-center rounded-full bg-amber-100 px-2 text-[11px] font-medium text-amber-700">
                    새 알림 {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}건
                  </span>
                ) : null}
              </div>
            )}
            </div>
          </div>
          <div className="flex items-center gap-2 pr-7">
            <PortalNotificationBell
              listNotifications={listClientNotifications}
              fetchUnreadCount={fetchClientNotificationUnreadCount}
              markAsRead={markClientNotificationRead}
              markAllAsRead={markAllClientNotificationsRead}
              getErrorMessage={getClientNotificationErrorMessage}
              onUnreadCountChange={setUnreadNotificationCount}
            />
            <HeaderActionButton
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              icon={LogOut}
              loading={loggingOut}
            >
              {loggingOut ? '로그아웃 중...' : '로그아웃'}
            </HeaderActionButton>
          </div>
        </div>
      </div>
    </header>
  )
}
