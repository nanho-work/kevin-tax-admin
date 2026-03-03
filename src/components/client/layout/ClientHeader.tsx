'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { checkClientSession, logoutClient } from '@/services/client/clientAuthService'
import { clearClientAccessToken } from '@/services/http'

function currentLabel(pathname: string) {
  if (pathname.startsWith('/client/dashboard')) return '대시보드'
  if (pathname.startsWith('/client/staff')) return '인사관리'
  if (pathname.startsWith('/client/companies')) return '고객사관리'
  if (pathname.startsWith('/client/setting')) return '설정'
  if (pathname.startsWith('/client/schedule')) return '일정관리'
  if (pathname.startsWith('/client/client-management')) return '클라이언트 관리'
  return '클라이언트'
}

export default function ClientHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const [name, setName] = useState<string>('')

  useEffect(() => {
    checkClientSession()
      .then((session) => setName(session.name))
      .catch(() => setName(''))
  }, [])

  const handleLogout = async () => {
    try {
      await logoutClient()
    } finally {
      clearClientAccessToken()
      router.replace('/login/client')
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/85 backdrop-blur">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-neutral-900">KEVIN TAX CLIENT</div>
            <div className="mt-0.5 text-xs text-neutral-500">{currentLabel(pathname)}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-neutral-600">{name ? `${name} 님` : ''}</div>
            <button
              type="button"
              onClick={handleLogout}
              className="h-9 rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
