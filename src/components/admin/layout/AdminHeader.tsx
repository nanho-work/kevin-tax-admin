'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { logoutAdmin } from '@/services/admin/adminService'
import NotificationBell from '@/components/admin/single-schedule/NotificationBell'
import { checkOutAdmin } from '@/services/admin/attendanceLogService'
import { useMemo } from 'react'
import { clearAdminAccessToken } from '@/services/http'

const Header = () => {
  const router = useRouter()
  const pathname = usePathname()

  const handleLogout = async () => {
    try {
      await checkOutAdmin() // ✅ 퇴근 기록
    } catch (e) {
      console.warn('⚠️ 퇴근 기록 실패:', e)
    }

    await logoutAdmin()
    clearAdminAccessToken()
    router.push('/login/staff')
  }

  const currentLabel = useMemo(() => {
    if (pathname.startsWith('/admin/companies')) return '고객사 관리'
    if (pathname.startsWith('/admin/staff') || pathname.startsWith('/admin/annualleave') || pathname.startsWith('/admin/attendance')) return '인사 관리'
    if (pathname.startsWith('/admin/single-schedule') || pathname.startsWith('/admin/tax-schedule')) return '일정 관리'
    if (pathname.startsWith('/admin/blog')) return '블로그'
    if (pathname.startsWith('/admin/gpt')) return 'GPT'
    if (pathname.startsWith('/admin/setting')) return '설정'
    if (pathname.startsWith('/admin/dashboard')) return '대시보드'
    return '어드민'
  }, [pathname])

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/85 backdrop-blur">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-neutral-900">KEVIN TAX ADMIN</div>
            <div className="mt-0.5 text-xs text-neutral-500">{currentLabel}</div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              type="button"
              onClick={handleLogout}
              className="h-9 rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              로그아웃
            </button>
          </div>
        </div>
        <div className="mt-2 text-xs text-neutral-500">
          <Link href="/admin/dashboard" className="hover:underline">대시보드</Link>
          <span className="mx-2 text-neutral-300">/</span>
          <span>{currentLabel}</span>
        </div>
      </div>
    </header>
  )
}

export default Header
