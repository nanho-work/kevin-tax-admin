'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { checkClientSession, logoutClient } from '@/services/client/clientAuthService'
import { clearClientAccessToken } from '@/services/http'

const menus = [
  { label: '대시보드', href: '/client/dashboard' },
  { label: '고객사관리', href: '/client/companies' },
  { label: '일정관리', href: '/client/schedule' },
  { label: '설정', href: '/client/setting' },
]

const staffManagementMenus = [
  { label: '직원목록/검색', href: '/client/staff' },
  { label: '직원등록', href: '/client/staff/register' },
  { label: '직원정보수정/재직상태', href: '/client/staff/profile-status' },
  { label: '직원휴가관리', href: '/client/staff/leave' },
  { label: '권한/조직배치', href: '/client/staff/organization' },
  { label: '근태기록 조회', href: '/client/staff/attendance' },
  { label: '휴가승인/반려 이력', href: '/client/staff/leave-history' },
  { label: '초기비밀번호 재설정/잠금해제', href: '/client/staff/account-security' },
]

const clientManagementMenus = [
  { label: '클라이언트(업체) 등록', href: '/client/client-management/company-create' },
  { label: '클라이언트(업체) 목록', href: '/client/client-management/company-list' },
  { label: '클라이언트(관리자) 등록', href: '/client/client-management/create' },
  { label: '클라이언트(관리자) 목록', href: '/client/client-management/list' },
]

const bookkeepingMenus = [
  { label: '기장 거래처 관리', href: '/client/bookkeeping/contracts' },
  { label: '월별 청구/수납 관리', href: '/client/bookkeeping/billings' },
  { label: '월별 집계', href: '/client/bookkeeping/summary' },
  { label: '자동이체 업로드(출금조회)', href: '/client/bookkeeping/debits' },
]

export default function ClientSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const hasStaffManagementPath = pathname.startsWith('/client/staff')
  const hasClientManagementPath = pathname.startsWith('/client/client-management')
  const hasBookkeepingPath = pathname.startsWith('/client/bookkeeping')
  const [isStaffManagementOpen, setIsStaffManagementOpen] = useState(hasStaffManagementPath)
  const [isClientManagementOpen, setIsClientManagementOpen] = useState(hasClientManagementPath)
  const [isBookkeepingOpen, setIsBookkeepingOpen] = useState(hasBookkeepingPath)
  const [canManageClients, setCanManageClients] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [profile, setProfile] = useState<{ name: string; companyName?: string } | null>(null)

  useEffect(() => {
    if (hasStaffManagementPath) setIsStaffManagementOpen(true)
  }, [hasStaffManagementPath])

  useEffect(() => {
    if (hasClientManagementPath) setIsClientManagementOpen(true)
  }, [hasClientManagementPath])

  useEffect(() => {
    if (hasBookkeepingPath) setIsBookkeepingOpen(true)
  }, [hasBookkeepingPath])

  useEffect(() => {
    const loadSession = async () => {
      try {
        const session = await checkClientSession()
        setCanManageClients(session.role_level === 0)
        setProfile({
          name: session.name,
          companyName: (session as any).client_company_name || undefined,
        })
      } catch {
        setCanManageClients(false)
        setProfile(null)
      } finally {
        setAuthLoading(false)
      }
    }
    loadSession()
  }, [])

  const handleLogout = async () => {
    try {
      await logoutClient()
    } finally {
      clearClientAccessToken()
      router.replace('/login/client')
    }
  }

  return (
    <aside className="h-full w-[260px] min-w-[260px] flex-shrink-0 border-r border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-5 py-4">
        <p className="text-xs text-neutral-500">클라이언트 포털</p>
        <p className="mt-1 text-sm font-semibold text-neutral-900">{profile?.companyName || '고객사'} 관리자</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-neutral-500">{profile?.name ? `${profile.name}님 환영합니다` : '세션 확인 중...'}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="h-6 rounded-md bg-neutral-900 px-2 text-[11px] font-medium text-white hover:bg-neutral-800"
          >
            로그아웃
          </button>
        </div>
      </div>
      <nav className="space-y-1 px-4 py-4">
        {menus.map((menu) => {
          const active = pathname === menu.href
          return (
            <Link key={menu.href} href={menu.href}>
              <div
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  active ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                {menu.label}
              </div>
            </Link>
          )
        })}

        <div className="pt-2">
          <button
            type="button"
            onClick={() => setIsStaffManagementOpen((prev) => !prev)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
              hasStaffManagementPath ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            <span>인사관리</span>
            <span aria-hidden>{isStaffManagementOpen ? '▾' : '▸'}</span>
          </button>
          {isStaffManagementOpen && (
            <div className="mt-1 space-y-1 pl-3">
              {staffManagementMenus.map((menu) => {
                const active = pathname === menu.href
                return (
                  <Link key={menu.href} href={menu.href}>
                    <div
                      className={`rounded-lg px-3 py-2 text-sm transition ${
                        active ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      {menu.label}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => setIsBookkeepingOpen((prev) => !prev)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
              hasBookkeepingPath ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            <span>기장 관리</span>
            <span aria-hidden>{isBookkeepingOpen ? '▾' : '▸'}</span>
          </button>
          {isBookkeepingOpen && (
            <div className="mt-1 space-y-1 pl-3">
              {bookkeepingMenus.map((menu) => {
                const active =
                  pathname === menu.href ||
                  (menu.href === '/client/bookkeeping/debits' && pathname.startsWith('/client/bookkeeping/debits'))
                return (
                  <Link key={menu.href} href={menu.href}>
                    <div
                      className={`rounded-lg px-3 py-2 text-sm transition ${
                        active ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      {menu.label}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {!authLoading && canManageClients ? (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsClientManagementOpen((prev) => !prev)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                hasClientManagementPath ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <span>클라이언트 관리</span>
              <span aria-hidden>{isClientManagementOpen ? '▾' : '▸'}</span>
            </button>
            {isClientManagementOpen && (
              <div className="mt-1 space-y-1 pl-3">
                {clientManagementMenus.map((menu) => {
                  const active = pathname === menu.href
                  return (
                    <Link key={menu.href} href={menu.href}>
                      <div
                        className={`rounded-lg px-3 py-2 text-sm transition ${
                          active ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-700 hover:bg-neutral-100'
                        }`}
                      >
                        {menu.label}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        ) : null}
      </nav>
    </aside>
  )
}
