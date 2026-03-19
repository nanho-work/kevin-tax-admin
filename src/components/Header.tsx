'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { logoutAdmin } from '@/services/admin/adminService'
import NotificationBell from './single-schedule/NotificationBell'
import { checkOutAdmin } from '@/services/attendanceLogService'
import { useMemo } from 'react'

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
    localStorage.removeItem('admin_access_token')
    router.push('/')
  }

  const currentLabel = useMemo(() => {
    if (pathname.startsWith('/companies')) return '업체 관리'
    if (pathname.startsWith('/staff') || pathname.startsWith('/annualleave') || pathname.startsWith('/attendance')) return '인사 관리'
    if (pathname.startsWith('/single-schedule') || pathname.startsWith('/tax-schedule')) return '일정 관리'
    if (pathname.startsWith('/blog')) return '블로그'
    if (pathname.startsWith('/gpt')) return 'GPT'
    if (pathname.startsWith('/setting')) return '설정'
    if (pathname.startsWith('/dashboard')) return '대시보드'
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
          <Link href="/dashboard" className="hover:underline">대시보드</Link>
          <span className="mx-2 text-neutral-300">/</span>
          <span>{currentLabel}</span>
        </div>
      </div>
    </header>
  )
}

export default Header
