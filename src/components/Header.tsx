'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { logoutAdmin } from '@/services/authService'
import NotificationBell from './single-schedule/NotificationBell'
import { checkOutAdmin } from '@/services/attendanceLogService'

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

  // 메뉴 정의
  const menus = [
    { label: '대시 보드', href: '/dashboard' },
    { label: '업체 관리', href: '/companies' },
    { label: '직원 관리', href: '/staff' },
    { label: '일정 관리', href: '/single-schedule' },
    { label: '설정', href: '/setting' },
  ]

  return (
    <header className="flex justify-between items-center px-6 py-3 border-b bg-white text-base">
      {/* 좌측: 메뉴 */}
      <nav className="flex gap-2">
        {menus.map(({ label, href }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1 rounded ${isActive
                  ? 'font-bold bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
                }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      {/* 우측: 알림 + 로그아웃 */}
      <div className="flex items-center gap-4">
        <NotificationBell />
        <button onClick={handleLogout} className="text-red-500 hover:underline">로그아웃</button>
      </div>
    </header>
  )
}

export default Header