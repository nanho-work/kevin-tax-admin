'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { logoutAdmin } from '@/services/authService'
import NotificationBell from './single-schedule/NotificationBell' 

const Header = () => {
  const router = useRouter()

  const handleLogout = async () => {
    await logoutAdmin()
    localStorage.removeItem('admin_access_token')
    router.push('/')
  }

  return (
    <header className="flex justify-between items-center px-6 py-3 border-b bg-white text-sm">
      {/* 좌측: 메뉴 */}
      <nav className="flex gap-5">
        <Link href="/dashboard" className="font-bold text-blue-800">대시 보드</Link>
        <Link href="#">고객 관리</Link>
        <Link href="#">상담 관리</Link>
        <Link href="#">리뷰 관리</Link>
        <Link href="#">서비스 관리</Link>
        <Link href="/companies">업체 관리</Link>
        <Link href="/staff">직원 관리</Link>
        <Link href="/single-schedule">일정 관리</Link>
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