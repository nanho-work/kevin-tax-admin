'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getAttendanceLogs } from '@/services/attendanceLogService'
import { checkAdminSession } from '@/services/adminService'
import { format } from 'date-fns'
import { RoleOut } from '@/types/role'


const hrdMenuItems = [
    { label: '휴가관리', href: '/annualleave', icon: '/vacation.png' },
    { label: '근태관리', href: '/attendance', icon: '/attendance.png' },
]

const companyMenuItems = [
    { label: '업체 리스트', href: '/companies', icon: '/company.png' },
    { label: '업체 등록', href: '/companies/new', icon: '/add_company.png' },
    { label: '회사 귀속 보고서', href: '/companies/tax', icon: '/tax_report.png' },
]

const scheduleMenuItems = [
    { label: '단발성 일정', href: '/single-schedule', icon: '/onetax.png' },
    { label: '거래처 일정', href: '/tax-schedule', icon: '/looptax.png' },
]

const settingMenuItems = [
    { label: '부서 관리', href: '/setting/department', icon: '/onetax.png' },
    { label: '팀 관리', href: '/setting/team', icon: '/looptax.png' },
    { label: '직급 관리', href: '/setting/role', icon: '/looptax.png' },
]

export default function Sidebar() {
    const pathname = usePathname()

    const [user, setUser] = useState<{
        id: number
        name: string
        profile_image_url?: string
        checkIn?: string
        role?: RoleOut | null
    } | null>(null)
    const [currentTime, setCurrentTime] = useState<string>(() =>
        new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    )

    useEffect(() => {
        async function fetchUser() {
            try {
                const admin = await checkAdminSession()
                console.log('[Sidebar] fetchAdminSession admin:', admin)
                console.log('불러온 관리자 정보:', admin)
                const today = format(new Date(), 'yyyy-MM-dd')
                const attendanceRes = await getAttendanceLogs({ admin_id: admin.id, date_to: today })
                const todayCheckIn = attendanceRes.items?.[0]?.check_in || null

                setUser({
                    id: admin.id,
                    name: admin.name,
                    profile_image_url: typeof admin.profile_image_url === 'string'
                        ? admin.profile_image_url
                        : undefined,
                    role: admin.role, // ✅ RoleOut 전체 전달
                    checkIn: todayCheckIn
                        ? new Date(todayCheckIn).toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit',
                        })
                        : undefined,
                })
            } catch (error) {
                console.error('세션 불러오기 실패', error)
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
    return (
        <aside className="py-10 bg-sky-600 text-white w-[240px] min-w-[240px] flex-shrink-0">
            {/* 상단 사용자 정보 */}
            <div className="flex flex-col items-center space-y-2">
                {user && (
                    <>
                        <img
                            src={user.profile_image_url || '/default-profile.png'}
                            alt="사용자 이미지"
                            className="w-24 h-24 rounded-full object-cover border-2 border-white"
                        />
                        <div className="text-base font-semibold">
                            {user.name} {user.role?.name || ''}님 환영합니다.
                        </div>
                        <div className="text-sm text-gray-300">출근시간: {user.checkIn}</div>
                        <div className="text-sm text-gray-300">현재시간: {currentTime}</div>
                    </>
                )}
            </div>

            <hr className="border-blue-400 border-2 my-4" />

            {/* 메뉴 */}
            <nav className="space-y-2">
                {(() => {
                    let menuItems = hrdMenuItems
                    if (pathname.startsWith('/companies')) {
                        menuItems = companyMenuItems
                    } else if (pathname.startsWith('/single-schedule') || pathname.startsWith('/tax-schedule')) {
                        menuItems = scheduleMenuItems
                    } else if (pathname.startsWith('/vacation') || pathname.startsWith('/attendance')) {
                        menuItems = hrdMenuItems
                    } else if (pathname.startsWith('/setting')) {
                        menuItems = settingMenuItems
                    }
                    return (
                        <div className="grid grid-cols-2 gap-2 px-4">
                            {menuItems.map((item) => (
                                <Link key={item.href} href={item.href}>
                                    <div
                                        className={`flex flex-col items-center justify-center p-4 rounded cursor-pointer hover:bg-gray-100 ${pathname === item.href ? 'bg-blue-600' : 'bg-gray-100/20'
                                            }`}
                                    >
                                        {item.icon && (
                                            <img
                                                src={item.icon}
                                                alt={`${item.label} 아이콘`}
                                                className="w-14 h-14"
                                            />
                                        )}
                                        <div className="mt-2 text-sm text-white text-center">{item.label}</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )
                })()}
            </nav>
        </aside>
    )
}