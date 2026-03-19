'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import ClientHeader from '@/components/client/layout/ClientHeader'
import ClientSidebar from '@/components/client/layout/ClientSidebar'
import WorkChatLauncher from '@/components/common/work-chat/WorkChatLauncher'
import { ClientSessionProvider, useClientSessionContext } from '@/contexts/ClientSessionContext'

function ProtectedClientShell({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { loading, session } = useClientSessionContext()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const isBoardRoute = pathname.startsWith('/client/staff/work-posts') && (searchParams.get('post_type') || '').toLowerCase() !== 'task'
  const effectiveCollapsed = isSidebarCollapsed || isBoardRoute

  useEffect(() => {
    const saved = window.localStorage.getItem('client_sidebar_collapsed')
    if (saved === '1') setIsSidebarCollapsed(true)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('client_sidebar_collapsed', isSidebarCollapsed ? '1' : '0')
  }, [isSidebarCollapsed])

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/login/client')
    }
  }, [loading, session, router])

  if (loading || !session) {
    return <p className="mt-20 text-center text-gray-500">클라이언트 인증 확인 중...</p>
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className={`relative z-30 h-full overflow-hidden transition-[width] duration-200 ${effectiveCollapsed ? 'w-14' : 'w-[260px]'}`}>
        <ClientSidebar
          collapsed={effectiveCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <ClientHeader />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <WorkChatLauncher
        portalType="client"
        actor={{
          type: 'client_account',
          id: Number((session as any)?.id ?? (session as any)?.account_id ?? 0),
        }}
      />
    </div>
  )
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClientSessionProvider>
      <ProtectedClientShell>{children}</ProtectedClientShell>
    </ClientSessionProvider>
  )
}
