'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import AdminSidebar from '@/components/admin/layout/AdminSidebar'
import AdminHeader from '@/components/admin/layout/AdminHeader'
import WorkChatLauncher from '@/components/common/work-chat/WorkChatLauncher'
import { AdminSessionProvider, useAdminSessionContext } from '@/contexts/AdminSessionContext'

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { loading, session } = useAdminSessionContext()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const isBoardRoute = pathname.startsWith('/admin/staff/work-posts') && (searchParams.get('post_type') || '').toLowerCase() !== 'task'
  const effectiveCollapsed = isSidebarCollapsed || isBoardRoute

  useEffect(() => {
    const saved = window.localStorage.getItem('admin_sidebar_collapsed')
    if (saved === '1') setIsSidebarCollapsed(true)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('admin_sidebar_collapsed', isSidebarCollapsed ? '1' : '0')
  }, [isSidebarCollapsed])

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
      <div className={`relative z-30 h-full overflow-hidden transition-[width] duration-200 ${effectiveCollapsed ? 'w-14' : 'w-[260px]'}`}>
        <AdminSidebar
          collapsed={effectiveCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <WorkChatLauncher
        portalType="admin"
        actor={{
          type: 'admin',
          id: Number((session as any)?.account_id ?? (session as any)?.id ?? 0),
        }}
      />
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
