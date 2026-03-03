'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { checkClientSession } from '@/services/client/clientAuthService'

export default function ClientManagementLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const verifyPermission = async () => {
      try {
        const session = await checkClientSession()
        if (session.role_level !== 0) {
          router.replace('/client/dashboard')
          return
        }
        setAllowed(true)
      } catch {
        router.replace('/login/client')
      } finally {
        setChecking(false)
      }
    }
    verifyPermission()
  }, [router])

  if (checking) {
    return <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">권한 확인 중...</div>
  }

  if (!allowed) {
    return null
  }

  return <>{children}</>
}
