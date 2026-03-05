'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type TabItem = { label: string; href: string }

function tabsByPath(pathname: string): TabItem[] {
  if (pathname.startsWith('/companies')) {
    return [
      { label: '업체 리스트', href: '/companies' },
      { label: '업체 등록', href: '/companies/new' },
      { label: '회사 귀속 보고서', href: '/companies/tax' },
    ]
  }
  if (pathname.startsWith('/staff') || pathname.startsWith('/annualleave') || pathname.startsWith('/attendance')) {
    return [
      { label: '직원 관리', href: '/staff' },
      { label: '휴가 관리', href: '/annualleave' },
      { label: '근태 관리', href: '/attendance' },
    ]
  }
  if (pathname.startsWith('/single-schedule') || pathname.startsWith('/tax-schedule')) {
    return [
      { label: '단발성 일정', href: '/single-schedule' },
      { label: '거래처 일정', href: '/tax-schedule' },
    ]
  }
  if (pathname.startsWith('/blog')) {
    return [
      { label: '블로그 목록', href: '/blog/list' },
      { label: '블로그 작성', href: '/blog/create' },
    ]
  }
  if (pathname.startsWith('/setting')) {
    return [
      { label: '부서 관리', href: '/setting/department' },
      { label: '팀 관리', href: '/setting/team' },
      { label: '직급 관리', href: '/setting/role' },
    ]
  }
  if (pathname.startsWith('/dashboard')) {
    return [{ label: '대시보드', href: '/dashboard' }]
  }
  if (pathname.startsWith('/gpt')) {
    return [{ label: 'GPT', href: '/gpt' }]
  }
  return []
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/companies') return pathname === href
  return pathname.startsWith(href)
}

export default function SectionTabs() {
  const pathname = usePathname()
  const tabs = tabsByPath(pathname)

  if (tabs.length === 0) return null

  return (
    <div className="mb-4 rounded-lg border border-zinc-200 bg-white px-4 pt-3">
      <div className="flex flex-wrap gap-2 border-b border-zinc-200">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-t-md px-4 py-2 text-sm ${
                active
                  ? 'border border-zinc-200 border-b-white bg-white font-semibold text-zinc-900'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

