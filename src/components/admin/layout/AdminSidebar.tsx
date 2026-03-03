'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getAttendanceLogs } from '@/services/admin/attendanceLogService'
import { checkAdminSession } from '@/services/admin/adminService'
import { format } from 'date-fns'

type MenuChild = { label: string; href: string }
type MenuSection = {
  key: string
  label: string
  href?: string
  children?: MenuChild[]
}

const menuSections: MenuSection[] = [
  { key: 'dashboard', label: '대시보드', href: '/admin/dashboard' },
  {
    key: 'companies',
    label: '고객사 관리',
    children: [
      { label: '고객사 리스트', href: '/admin/companies' },
      { label: '고객사 등록', href: '/admin/companies/new' },
      { label: '고객사 귀속 보고서', href: '/admin/companies/tax' },
    ],
  },
  {
    key: 'staff',
    label: '인사 관리',
    children: [
      { label: '직원 관리', href: '/admin/staff' },
      { label: '휴가 관리', href: '/admin/annualleave' },
      { label: '근태 관리', href: '/admin/attendance' },
    ],
  },
  {
    key: 'schedule',
    label: '일정 관리',
    children: [
      { label: '단발성 일정', href: '/admin/single-schedule' },
      { label: '거래처 일정', href: '/admin/tax-schedule' },
    ],
  },
  {
    key: 'blog',
    label: '블로그',
    children: [
      { label: '블로그 목록', href: '/admin/blog/list' },
      { label: '블로그 작성', href: '/admin/blog/create' },
    ],
  },
  { key: 'gpt', label: 'GPT', href: '/admin/gpt' },
  {
    key: 'setting',
    label: '설정',
    children: [
      { label: '부서 관리', href: '/admin/setting/department' },
      { label: '팀 관리', href: '/admin/setting/team' },
      { label: '직급 관리', href: '/admin/setting/role' },
    ],
  },
]

function getActiveSection(pathname: string): string {
  if (pathname.startsWith('/admin/companies')) return 'companies'
  if (pathname.startsWith('/admin/staff') || pathname.startsWith('/admin/annualleave') || pathname.startsWith('/admin/attendance')) return 'staff'
  if (pathname.startsWith('/admin/single-schedule') || pathname.startsWith('/admin/tax-schedule')) return 'schedule'
  if (pathname.startsWith('/admin/blog')) return 'blog'
  if (pathname.startsWith('/admin/gpt')) return 'gpt'
  if (pathname.startsWith('/admin/setting')) return 'setting'
  if (pathname.startsWith('/admin/dashboard')) return 'dashboard'
  return ''
}

function isChildActive(pathname: string, href: string): boolean {
  return pathname === href
}

export default function Sidebar() {
  const pathname = usePathname()

  const [user, setUser] = useState<{
    id: number
    name: string
    profile_image_url?: string
    checkIn?: string
    roleLevel?: number
    roleName?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState<string>(() =>
    new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  )
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function fetchUser() {
      try {
        setLoading(true)
        setErrorMessage(null)
        const admin = await checkAdminSession()
        const sessionAccountId = (admin as any).account_id ?? (admin as any).id
        if (typeof sessionAccountId !== 'number') {
          throw new Error('세션 account_id가 없습니다.')
        }

        setUser({
          id: sessionAccountId,
          name: admin.name,
          profile_image_url: typeof (admin as any).profile_image_url === 'string'
            ? (admin as any).profile_image_url
            : undefined,
          roleName: (admin as any).role_name ?? (admin as any).role?.name,
          roleLevel: admin.role_level ?? (admin as any).role?.level,
          checkIn: undefined,
        })

        try {
          const today = format(new Date(), 'yyyy-MM-dd')
          const attendanceRes = await getAttendanceLogs({ admin_id: sessionAccountId, date_to: today })
          const todayCheckIn = attendanceRes.items?.[0]?.check_in || null

          if (todayCheckIn) {
            setUser((prev) =>
              prev
                ? {
                    ...prev,
                    checkIn: new Date(todayCheckIn).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  }
                : prev
            )
          }
        } catch (attendanceError) {
          console.warn('근태 정보 조회 실패:', attendanceError)
        }
      } catch (error) {
        console.error('세션 불러오기 실패', error)
        setErrorMessage('사용자 정보를 불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    }
    fetchUser()

    const timeInterval = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      )
    }, 1000)

    return () => clearInterval(timeInterval)
  }, [])

  useEffect(() => {
    const activeKey = getActiveSection(pathname)
    if (!activeKey) return
    setExpanded((prev) => ({ ...prev, [activeKey]: true }))
  }, [pathname])

  const activeSection = getActiveSection(pathname)

  return (
    <aside className="w-[260px] min-w-[260px] flex-shrink-0 border-r border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-5 py-4">
        <p className="text-xs text-neutral-500">관리자</p>
        {loading ? (
          <>
            <div className="mt-2 h-4 w-36 animate-pulse rounded bg-neutral-100" />
            <div className="mt-2 h-3 w-40 animate-pulse rounded bg-neutral-100" />
          </>
        ) : user ? (
          <div className="mt-2">
            <div className="flex items-center gap-3">
              <img
                src={user.profile_image_url || '/default-profile.png'}
                alt="사용자 이미지"
                className="h-12 w-12 rounded-full border border-neutral-200 object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {user.name} {user.roleName || ''}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">출근시간: {user.checkIn ?? '-'}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-neutral-500">현재시간: {currentTime}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-rose-600">{errorMessage ?? '사용자 정보가 없습니다.'}</p>
        )}
      </div>

      <nav className="px-4 py-4">
        <p className="px-1 pb-2 text-xs font-medium text-neutral-500">메뉴</p>
        <div className="space-y-1">
          {menuSections.map((section) => {
            const isActiveSection = activeSection === section.key
            const hasChildren = Boolean(section.children?.length)

            if (!hasChildren && section.href) {
              return (
                <Link key={section.key} href={section.href}>
                  <div
                    className={`rounded-lg px-3 py-2 text-sm transition ${
                      isActiveSection ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    {section.label}
                  </div>
                </Link>
              )
            }

            const isOpen = Boolean(expanded[section.key])
            const visibleChildren = section.children?.filter((child) => {
              if (child.href === '/admin/setting/role' && (user?.roleLevel ?? 99) >= 2) return false
              return true
            }) ?? []

            if (visibleChildren.length === 0) {
              return null
            }

            return (
              <div key={section.key} className="rounded-lg border border-neutral-200 bg-white">
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [section.key]: !isOpen }))}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                    isActiveSection ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <span>{section.label}</span>
                  <span className="text-xs">{isOpen ? '▾' : '▸'}</span>
                </button>
                {isOpen ? (
                  <div className="space-y-1 border-t border-neutral-200 px-2 py-2">
                    {visibleChildren.map((child) => (
                      <Link key={child.href} href={child.href}>
                        <div
                          className={`rounded-md px-3 py-2 text-xs transition ${
                            isChildActive(pathname, child.href)
                              ? 'bg-neutral-100 font-medium text-neutral-900'
                              : 'text-neutral-600 hover:bg-neutral-50'
                          }`}
                        >
                          {child.label}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </nav>
    </aside>
  )
}
