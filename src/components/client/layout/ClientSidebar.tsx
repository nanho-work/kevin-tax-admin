'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { checkClientSession } from '@/services/client/clientAuthService'

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

export default function ClientSidebar() {
  const pathname = usePathname()
  const hasStaffManagementPath = pathname.startsWith('/client/staff')
  const hasClientManagementPath = pathname.startsWith('/client/client-management')
  const [isStaffManagementOpen, setIsStaffManagementOpen] = useState(hasStaffManagementPath)
  const [isClientManagementOpen, setIsClientManagementOpen] = useState(hasClientManagementPath)
  const [canManageClients, setCanManageClients] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    if (hasStaffManagementPath) setIsStaffManagementOpen(true)
  }, [hasStaffManagementPath])

  useEffect(() => {
    if (hasClientManagementPath) setIsClientManagementOpen(true)
  }, [hasClientManagementPath])

  useEffect(() => {
    const loadSession = async () => {
      try {
        const session = await checkClientSession()
        setCanManageClients(session.role_level === 0)
      } catch {
        setCanManageClients(false)
      } finally {
        setAuthLoading(false)
      }
    }
    loadSession()
  }, [])

  return (
    <aside className="w-[260px] min-w-[260px] flex-shrink-0 border-r border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-5 py-4">
        <p className="text-xs text-neutral-500">클라이언트 포털</p>
        <p className="mt-1 text-sm font-semibold text-neutral-900">메뉴</p>
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
