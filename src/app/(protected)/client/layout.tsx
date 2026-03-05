'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { checkClientSession } from '@/services/client/clientAuthService'
import ClientHeader from '@/components/client/layout/ClientHeader'
import ClientSidebar from '@/components/client/layout/ClientSidebar'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    const verify = async () => {
      try {
        await checkClientSession()
        setVerified(true)
      } catch {
        router.replace('/login/client')
      }
    }
    verify()
  }, [router])

  if (!verified) {
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
