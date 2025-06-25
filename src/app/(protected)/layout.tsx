'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import { checkAdminSession } from '@/services/authService'


export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isVerified, setIsVerified] = useState(false)

  useEffect(() => {
    const verify = async () => {
      try {
        await checkAdminSession()
        setIsVerified(true)
      } catch {
        router.replace('/login')
      }
    }

    verify()
  }, [router])

  if (!isVerified) {
    return (
      <p className="text-center mt-20 text-gray-500">인증 확인 중...</p>
    )
  }

  return (
    <>
      <Header />
      <main className="p-6">{children}</main>
    </>
  )
}