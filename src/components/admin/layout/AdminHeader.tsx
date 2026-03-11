'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import BackButton from '@/components/common/BackButton'
import { listMailAccounts } from '@/services/admin/mailService'
import { useAdminSessionContext } from '@/contexts/AdminSessionContext'
import { filterAdminVisibleMailAccounts } from '@/utils/mailAccountScope'

const Header = () => {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { session } = useAdminSessionContext()
  const [mailAccounts, setMailAccounts] = useState<Array<{ id: number; email: string }>>([])
  const [headerMailAccountId, setHeaderMailAccountId] = useState('')
  const [headerKeyword, setHeaderKeyword] = useState('')
  const isAdminMailInbox = pathname.startsWith('/admin/mail/inbox')

  const currentLabel = useMemo(() => {
    if (pathname.startsWith('/admin/companies')) return '고객사 관리'
    if (pathname.startsWith('/admin/mail/inbox')) return '메일 > 메일함'
    if (pathname.startsWith('/admin/mail/compose')) return '메일 > 메일작성'
    if (pathname.startsWith('/admin/mail/accounts')) return '메일 > 설정'
    if (pathname.startsWith('/admin/mail')) return '메일'
    if (pathname.startsWith('/admin/tax-schedule')) return '일정 관리'
    if (pathname.startsWith('/admin/staff/my-leave')) return '마이페이지 > 내휴가관리'
    if (pathname.startsWith('/admin/staff/documents/new')) return '마이페이지 > 문서작성'
    if (pathname.startsWith('/admin/staff/documents')) return '마이페이지 > 내 결재문서'
    if (pathname.startsWith('/admin/staff/attendance')) return '마이페이지 > 출퇴근 관리'
    if (pathname.startsWith('/admin/staff/account')) return '마이페이지 > 비밀번호 관리'
    if (pathname.startsWith('/admin/staff')) return '마이페이지'
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

  useEffect(() => {
    if (!isAdminMailInbox) return
    void listMailAccounts(true)
      .then((res) => {
        const visibleItems = filterAdminVisibleMailAccounts(res.items || [], session?.id)
        const items = visibleItems.map((item) => ({ id: item.id, email: item.email }))
        setMailAccounts(items)
      })
      .catch(() => {
        setMailAccounts([])
      })
  }, [isAdminMailInbox, session?.id])

  useEffect(() => {
    if (!isAdminMailInbox) return
    setHeaderMailAccountId(searchParams.get('account_id') || '')
    setHeaderKeyword(searchParams.get('q') || '')
  }, [isAdminMailInbox, searchParams])

  const replaceHeaderSearch = (next: { accountId?: string; keyword?: string }) => {
    const params = new URLSearchParams(searchParams.toString())
    const accountId = next.accountId ?? headerMailAccountId
    const keyword = next.keyword ?? headerKeyword

    if (accountId) params.set('account_id', accountId)
    else params.delete('account_id')

    if (keyword.trim()) params.set('q', keyword.trim())
    else params.delete('q')

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/85 backdrop-blur">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-neutral-900">KEVIN TAX ADMIN</div>
            <div className="mt-0.5 text-xs text-neutral-500">{currentLabel}</div>
          </div>
          {isAdminMailInbox ? (
            <div className="flex items-center gap-2 pr-7">
              <select
                className="h-9 w-56 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                value={headerMailAccountId}
                onChange={(e) => {
                  const nextAccountId = e.target.value
                  setHeaderMailAccountId(nextAccountId)
                  replaceHeaderSearch({ accountId: nextAccountId })
                }}
              >
                <option value="">전체 계정</option>
                {mailAccounts.map((account) => (
                  <option key={account.id} value={String(account.id)}>
                    {account.email}
                  </option>
                ))}
              </select>
              <input
                className="h-9 w-56 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                value={headerKeyword}
                onChange={(e) => setHeaderKeyword(e.target.value)}
                placeholder="제목/발신자/본문 검색"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    replaceHeaderSearch({ keyword: headerKeyword })
                  }
                }}
              />
            </div>
          ) : backPath ? (
            <BackButton fallbackPath={backPath} />
          ) : null}
        </div>
      </div>
    </header>
  )
}

export default Header
