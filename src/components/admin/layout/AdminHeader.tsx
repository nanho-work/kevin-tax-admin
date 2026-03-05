'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import BackButton from '@/components/common/BackButton'

const Header = () => {
  const pathname = usePathname()

  const currentLabel = useMemo(() => {
    if (pathname.startsWith('/admin/companies')) return '고객사 관리'
    if (pathname.startsWith('/admin/tax-schedule')) return '일정 관리'
    if (pathname.startsWith('/admin/blog')) return '블로그'
    if (pathname.startsWith('/admin/gpt')) return 'GPT'
    if (pathname.startsWith('/admin/setting')) return '설정'
    if (pathname.startsWith('/admin/dashboard')) return '대시보드'
    return '어드민'
  }, [pathname])

  const backPath = useMemo(() => {
    if (pathname.startsWith('/admin/companies/') && pathname !== '/admin/companies/new') return '/admin/companies'
    if (pathname.startsWith('/admin/companies/new')) return '/admin/companies'
    if (pathname.startsWith('/admin/companies/account/new')) return '/admin/companies/account'
    return null
  }, [pathname])

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/85 backdrop-blur">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-neutral-900">KEVIN TAX ADMIN</div>
            <div className="mt-0.5 text-xs text-neutral-500">{currentLabel}</div>
          </div>
          {backPath ? <BackButton fallbackPath={backPath} /> : null}
        </div>
        <div className="mt-2 text-xs text-neutral-500">
          <Link href="/admin/dashboard" className="hover:underline">대시보드</Link>
          <span className="mx-2 text-neutral-300">/</span>
          <span>{currentLabel}</span>
        </div>
      </div>
    </header>
  )
}

export default Header
