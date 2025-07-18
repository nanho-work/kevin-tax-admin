'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import { checkAdminSession } from '@/services/authService'
import Sidebar from '@/components/Sidebar'


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
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="p-6 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}