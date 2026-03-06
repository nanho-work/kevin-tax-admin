'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ClientHeader from '@/components/client/layout/ClientHeader'
import ClientSidebar from '@/components/client/layout/ClientSidebar'
import { ClientSessionProvider, useClientSessionContext } from '@/contexts/ClientSessionContext'

function ProtectedClientShell({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { loading, session } = useClientSessionContext()

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
      <div className="relative z-30 h-full">
        <ClientSidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <ClientHeader />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
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
