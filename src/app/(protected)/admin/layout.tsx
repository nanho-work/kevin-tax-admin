'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminHeader from '@/components/admin/layout/AdminHeader'
import { checkAdminSession } from '@/services/admin/adminService'
import AdminSidebar from '@/components/admin/layout/AdminSidebar'


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
        router.replace('/login/staff')
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
    <div className="flex h-screen flex-col">
      <AdminHeader />
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
