'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getAttendanceLogs } from '@/services/attendanceLogService'
import { checkAdminSession } from '@/services/admin/adminService'
import { format } from 'date-fns'
import { RoleOut } from '@/types/role'


const primaryMenus = [
    { key: 'dashboard', label: '대시보드', href: '/dashboard' },
    { key: 'companies', label: '업체 관리', href: '/companies' },
    { key: 'staff', label: '인사 관리', href: '/staff' },
    { key: 'schedule', label: '일정 관리', href: '/single-schedule' },
    { key: 'blog', label: '블로그', href: '/blog/list' },
    { key: 'gpt', label: 'GPT', href: '/gpt' },
    { key: 'setting', label: '설정', href: '/setting' },
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
    const [loading, setLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [currentTime, setCurrentTime] = useState<string>(() =>
        new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    )

    useEffect(() => {
        async function fetchUser() {
            try {
                setLoading(true)
                setErrorMessage(null)
                const admin = await checkAdminSession()
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
                            timeZone: 'Asia/Seoul',
                            hour: '2-digit',
                            minute: '2-digit',
                        })
                        : undefined,
                })
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
                new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit' })
            )
        }, 1000)

        return () => clearInterval(timeInterval)
    }, [])

    const currentKey = (() => {
        if (pathname.startsWith('/companies')) return 'companies'
        if (pathname.startsWith('/staff') || pathname.startsWith('/annualleave') || pathname.startsWith('/attendance')) return 'staff'
        if (pathname.startsWith('/single-schedule') || pathname.startsWith('/tax-schedule')) return 'schedule'
        if (pathname.startsWith('/blog')) return 'blog'
        if (pathname.startsWith('/gpt')) return 'gpt'
        if (pathname.startsWith('/setting')) return 'setting'
        if (pathname.startsWith('/dashboard')) return 'dashboard'
        return ''
    })()

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
                                    {user.name} {user.role?.name || ''}
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
                    {primaryMenus.map((item) => {
                        const isActive = currentKey === item.key
                        return (
                            <Link key={item.href} href={item.href}>
                                <div
                                    className={`rounded-lg px-3 py-2 text-sm transition ${
                                        isActive
                                            ? 'bg-neutral-900 text-white'
                                            : 'text-neutral-700 hover:bg-neutral-100'
                                    }`}
                                >
                                    {item.label}
                                </div>
                            </Link>
                        )
                    })}
                </div>
            </nav>
        </aside>
    )
}
