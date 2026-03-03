'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { checkAdminSession } from '@/services/admin/adminService'
import { checkClientSession } from '@/services/client/clientAuthService'
import { clearAllAccessTokens } from '@/services/http'

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const verify = async () => {
      try {
        await checkAdminSession()
        router.replace('/admin/dashboard')
        return
      } catch {}

      try {
        await checkClientSession()
        router.replace('/client/dashboard')
      } catch {
        clearAllAccessTokens()
        router.replace('/login')
      } finally {
        setChecking(false)
      }
    }

    verify()
  }, [router])

  if (checking) {
    return <p className="text-center mt-20 text-gray-500">인증 확인 중...</p>
  }

  return null
}
