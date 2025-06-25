'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { checkAdminSession } from '@/services/authService'

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const verify = async () => {
      try {
        await checkAdminSession()
        router.replace('/dashboard') // 세션 존재 시 이동
      } catch {
        localStorage.removeItem('admin_access_token')
        router.replace('/login') // 세션 없을 시 이동
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