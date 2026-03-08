'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import AdminSidebar from '@/components/admin/layout/AdminSidebar'
import { AdminSessionProvider, useAdminSessionContext } from '@/contexts/AdminSessionContext'

function currentLabel(pathname: string) {
  if (pathname.startsWith('/admin/companies')) return '고객사 관리'
  if (pathname.startsWith('/admin/tax-schedule')) return '일정 관리'
  if (pathname.startsWith('/admin/company-withholding')) return '고객사 원천세'
  if (pathname.startsWith('/admin/staff/my-leave')) return '마이페이지 > 내휴가관리'
  if (pathname.startsWith('/admin/staff/profile')) return '마이페이지 > 프로필'
  if (pathname.startsWith('/admin/staff/personal-documents')) return '마이페이지 > 프로필'
  if (pathname.startsWith('/admin/staff/documents/new')) return '마이페이지 > 문서작성'
  if (pathname.startsWith('/admin/staff/documents')) return '마이페이지 > 내 결재문서'
  if (pathname.startsWith('/admin/staff/attendance')) return '마이페이지 > 출퇴근 관리'
  if (pathname.startsWith('/admin/staff/account')) return '마이페이지 > 프로필'
  if (pathname.startsWith('/admin/staff')) return '마이페이지'
  if (pathname.startsWith('/admin/blog')) return '블로그'
  if (pathname.startsWith('/admin/gpt')) return 'GPT'
  if (pathname.startsWith('/admin/setting')) return '설정'
  if (pathname.startsWith('/admin/dashboard')) return '대시보드'
  return '어드민'
}

function shouldShowBackButton(pathname: string) {
  if (/^\/admin\/companies\/[^/]+$/.test(pathname)) return true
  if (/^\/admin\/blog\/[^/]+$/.test(pathname)) return true
  return false
}

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { loading, session } = useAdminSessionContext()
  const showBackButton = shouldShowBackButton(pathname)

  useEffect(() => {
    if (loading) return
    if (!session) {
      router.replace('/login/staff')
    }
  }, [loading, session, router])

  if (!session) {
    return (
      <p className="text-center mt-20 text-gray-500">인증 확인 중...</p>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="relative z-30 h-full">
        <AdminSidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/85 backdrop-blur">
          <div className="px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              {showBackButton ? (
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="inline-flex h-8 items-center rounded-md border border-neutral-300 bg-white px-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  뒤로가기
                </button>
              ) : null}
              <div className="text-sm font-semibold text-neutral-900">{currentLabel(pathname)}</div>
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              <Link href="/admin/dashboard" className="hover:underline">대시보드</Link>
              <span className="mx-2 text-neutral-300">/</span>
              <span>{currentLabel(pathname)}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminSessionProvider>
      <ProtectedShell>{children}</ProtectedShell>
    </AdminSessionProvider>
  )
}
