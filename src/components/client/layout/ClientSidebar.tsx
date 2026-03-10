'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { logoutClient } from '@/services/client/clientAuthService'
import { listMailAccounts, listMailMessages } from '@/services/client/clientMailService'
import { clearClientAccessToken } from '@/services/http'
import { useClientSessionContext } from '@/contexts/ClientSessionContext'
import { getClientRoleRank } from '@/utils/roleRank'

const menus = [
  { label: '대시보드', href: '/client/dashboard' },
  { label: '일정관리', href: '/client/schedule' },
]

const mailMenus = [
  { label: '메일쓰기', href: '/client/mail/compose' },
  { label: '설정', href: '/client/mail/accounts' },
]

const companyManagementMenus = [
  { label: '거래처 기본사항', href: '/client/companies' },
]

const staffManagementMenus = [
  { label: '직원목록/검색', href: '/client/staff' },
  { label: '직원가입신청', href: '/client/staff/signup-requests' },
  { label: '직원휴가관리', href: '/client/staff/leave' },
  { label: '결재 문서 승인', href: '/client/staff/approvals/documents' },
  { label: '권한/조직배치', href: '/client/staff/organization' },
  { label: '근태기록 조회', href: '/client/staff/attendance' },
  { label: '초기비밀번호 재설정/잠금해제', href: '/client/staff/account-security' },
]

const clientManagementMenus = [
  { label: '클라이언트(업체) 등록', href: '/client/client-management/company-create' },
  { label: '클라이언트(업체) 목록', href: '/client/client-management/company-list' },
  { label: '클라이언트(관리자) 등록', href: '/client/client-management/create' },
  { label: '클라이언트(관리자) 목록', href: '/client/client-management/list' },
  { label: '샘플양식 업로드', href: '/client/client-management/templates' },
  { label: '메일운영대시보드', href: '/client/client-management/mail-ops-dashboard' },
  { label: '블로그 목록', href: '/client/client-management/blog/list' },
]

const bookkeepingMenus = [
  { label: '기장 거래처 관리', href: '/client/bookkeeping/contracts' },
  { label: '월별 청구/수납 관리', href: '/client/bookkeeping/billings' },
  { label: '월별 집계', href: '/client/bookkeeping/summary' },
  { label: '입금내역', href: '/client/bookkeeping/debits' },
  { label: '자동이체 업로드', href: '/client/bookkeeping/debits/upload' },
  { label: '업로드 이력', href: '/client/bookkeeping/debits/history' },
]

const settingMenus = [
  { label: '비밀번호 변경', href: '/client/setting/account' },
  { label: '로그/보안', href: '/client/setting/security' },
]

type ClientSidebarProps = {
  collapsed?: boolean
  onToggleCollapse?: () => void
}

function isMenuActive(pathname: string, searchParams: URLSearchParams, href: string): boolean {
  const [targetPath, queryString] = href.split('?')
  if (pathname !== targetPath) return false
  if (!queryString) return true
  const targetQuery = new URLSearchParams(queryString)
  for (const [key, value] of targetQuery.entries()) {
    if (searchParams.get(key) !== value) return false
  }
  return true
}

export default function ClientSidebar({ collapsed = false, onToggleCollapse }: ClientSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const hasMailPath = pathname.startsWith('/client/mail')
  const hasCompanyManagementPath = pathname.startsWith('/client/companies')
  const hasStaffManagementPath = pathname.startsWith('/client/staff')
  const hasClientManagementPath = pathname.startsWith('/client/client-management')
  const hasBookkeepingPath = pathname.startsWith('/client/bookkeeping')
  const hasSettingPath = pathname.startsWith('/client/setting')
  const [isCompanyManagementOpen, setIsCompanyManagementOpen] = useState(hasCompanyManagementPath)
  const [isMailOpen, setIsMailOpen] = useState(hasMailPath)
  const [isStaffManagementOpen, setIsStaffManagementOpen] = useState(hasStaffManagementPath)
  const [isClientManagementOpen, setIsClientManagementOpen] = useState(hasClientManagementPath)
  const [isBookkeepingOpen, setIsBookkeepingOpen] = useState(hasBookkeepingPath)
  const [isSettingOpen, setIsSettingOpen] = useState(hasSettingPath)
  const [mailAccounts, setMailAccounts] = useState<Array<{ id: number; email: string; account_scope: 'company' | 'personal' }>>([])
  const [mailAccountCounts, setMailAccountCounts] = useState<Record<number, { all: number; inboxUnread: number; sent: number; trash: number }>>({})
  const [expandedMailAccounts, setExpandedMailAccounts] = useState<Record<number, boolean>>({})
  const { session, loading } = useClientSessionContext()
  const canManageClients = getClientRoleRank(session) === 0
  const profile = useMemo(
    () => ({
      name: session?.name || '',
      companyName: (session as any)?.client_company_name || undefined,
    }),
    [session]
  )

  const buildMailAccountHref = (accountId: number, mailbox: 'all' | 'inbox' | 'sent' | 'trash') =>
    `/client/mail/inbox?mailbox=${mailbox}&account_id=${accountId}`

  const isMailAccountMenuActive = (accountId: number, mailbox: 'all' | 'inbox' | 'sent' | 'trash') =>
    pathname === '/client/mail/inbox' &&
    searchParams.get('account_id') === String(accountId) &&
    searchParams.get('mailbox') === mailbox

  useEffect(() => {
    if (hasMailPath) setIsMailOpen(true)
  }, [hasMailPath])

  useEffect(() => {
    if (hasCompanyManagementPath) setIsCompanyManagementOpen(true)
  }, [hasCompanyManagementPath])

  useEffect(() => {
    if (hasStaffManagementPath) setIsStaffManagementOpen(true)
  }, [hasStaffManagementPath])

  useEffect(() => {
    if (hasClientManagementPath) setIsClientManagementOpen(true)
  }, [hasClientManagementPath])

  useEffect(() => {
    if (hasBookkeepingPath) setIsBookkeepingOpen(true)
  }, [hasBookkeepingPath])

  useEffect(() => {
    if (hasSettingPath) setIsSettingOpen(true)
  }, [hasSettingPath])

  useEffect(() => {
    const selectedAccountId = Number(searchParams.get('account_id') || '')
    if (!Number.isFinite(selectedAccountId) || selectedAccountId <= 0) return
    setExpandedMailAccounts((prev) => (prev[selectedAccountId] ? prev : { ...prev, [selectedAccountId]: true }))
  }, [searchParams])

  useEffect(() => {
    if (loading || !session) return

    const loadMailCounts = async () => {
      try {
        const accountRes = await listMailAccounts(true)
        const accounts = (accountRes.items || []).map((item) => ({
          id: item.id,
          email: item.email,
          account_scope: item.account_scope || 'company',
        }))
        setMailAccounts(accounts)

        const nextCounts: Record<number, { all: number; inboxUnread: number; sent: number; trash: number }> = {}
        await Promise.all(
          accounts.map(async (account) => {
            try {
              const [allRes, inboxUnreadRes, sentRes, trashRes] = await Promise.all([
                listMailMessages({ page: 1, size: 1, mail_account_id: account.id }),
                listMailMessages({ page: 1, size: 1, mail_account_id: account.id, mailbox_type: 'inbox', is_read: false }),
                listMailMessages({ page: 1, size: 1, mail_account_id: account.id, direction: 'outbound' }),
                listMailMessages({ page: 1, size: 1, mail_account_id: account.id, include_trash: true }),
              ])
              nextCounts[account.id] = {
                all: allRes.total ?? 0,
                inboxUnread: inboxUnreadRes.total ?? 0,
                sent: sentRes.total ?? 0,
                trash: trashRes.total ?? 0,
              }
            } catch {
              nextCounts[account.id] = { all: 0, inboxUnread: 0, sent: 0, trash: 0 }
            }
          })
        )
        setMailAccountCounts(nextCounts)
      } catch {
        setMailAccounts([])
        setMailAccountCounts({})
      }
    }

    void loadMailCounts()
  }, [session, loading, pathname, searchParams])

  const handleLogout = async () => {
    try {
      await logoutClient()
    } finally {
      clearClientAccessToken()
      router.replace('/login/client')
    }
  }

  if (collapsed) {
    return (
      <aside className="h-full w-full border-r border-neutral-200 bg-white">
        <div className="flex items-center justify-center border-b border-neutral-200 px-2 py-4">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 text-neutral-700 transition hover:bg-neutral-50"
            aria-label="사이드바 열기"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-neutral-500">{profile.companyName || '고객사'} 관리자</p>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-neutral-300 text-neutral-700 transition hover:bg-neutral-50"
            aria-label="사이드바 접기"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
        {loading ? (
          <>
            <div className="mt-2 h-4 w-24 animate-pulse rounded bg-neutral-100" />
            <div className="mt-2 h-3 w-40 animate-pulse rounded bg-neutral-100" />
          </>
        ) : (
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-neutral-500">{profile.name ? `${profile.name}님` : '세션 확인 중...'}</p>
            <button
              type="button"
              onClick={handleLogout}
              className="h-6 rounded-md bg-neutral-900 px-2 text-[11px] font-medium text-white hover:bg-neutral-800"
            >
              로그아웃
            </button>
          </div>
        )}
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <p className="px-1 pb-2 text-xs font-medium text-neutral-500">메뉴</p>
        <div className="space-y-1">
        {menus.map((menu) => {
          const active = pathname === menu.href
          return (
            <Link key={menu.href} href={menu.href}>
              <div
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  active ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                {menu.label}
              </div>
            </Link>
          )
        })}

        <div className="pt-2 rounded-lg border border-neutral-200 bg-white">
          <button
            type="button"
            onClick={() => setIsMailOpen((prev) => !prev)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
              hasMailPath ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            <span>메일</span>
            <span aria-hidden>{isMailOpen ? '▾' : '▸'}</span>
          </button>
          {isMailOpen && (
            <div className="space-y-1 border-t border-neutral-200 px-2 py-2">
              <div className="grid grid-cols-2 gap-2">
                {mailMenus.map((menu) => (
                  <Link key={menu.href} href={menu.href}>
                    <div
                      className={`rounded-md border px-3 py-2 text-center text-xs transition ${
                        isMenuActive(pathname, searchParams, menu.href)
                          ? 'border-neutral-900 bg-neutral-900 font-medium text-white'
                          : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      <span>{menu.label}</span>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="my-2 border-t border-neutral-200" />
              <p className="px-2 text-[10px] font-semibold text-neutral-500">법인계정</p>
              {mailAccounts.filter((account) => account.account_scope === 'company').map((account) => {
                const active = pathname === '/client/mail/inbox' && searchParams.get('account_id') === String(account.id)
                const isOpen = Boolean(expandedMailAccounts[account.id]) || active
                const counts = mailAccountCounts[account.id] || { all: 0, inboxUnread: 0, sent: 0, trash: 0 }
                return (
                  <div key={`company-${account.id}`} className="rounded-md border border-neutral-200">
                    <button
                      type="button"
                      onClick={() => setExpandedMailAccounts((prev) => ({ ...prev, [account.id]: !isOpen }))}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-[11px] transition ${
                        active ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'
                      }`}
                      title={account.email}
                    >
                      <span className="truncate">{account.email}</span>
                      <div className="flex items-center gap-1">
                        {counts.inboxUnread > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            <span className="animate-pulse text-[10px] leading-none text-amber-500">★</span>
                            <span>{counts.inboxUnread.toLocaleString('ko-KR')}</span>
                          </span>
                        ) : (
                          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600">0</span>
                        )}
                        <span className="text-[10px]">{isOpen ? '▾' : '▸'}</span>
                      </div>
                    </button>
                    {isOpen ? (
                      <div className="space-y-0.5 border-t border-neutral-200 bg-white px-2 py-1.5">
                        <Link href={buildMailAccountHref(account.id, 'all')}>
                          <div className={`flex items-center justify-between rounded px-2 py-1 text-[11px] transition ${isMailAccountMenuActive(account.id, 'all') ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'}`}>
                            <span>전체메일</span>
                            <span>{counts.all.toLocaleString('ko-KR')}</span>
                          </div>
                        </Link>
                        <Link href={buildMailAccountHref(account.id, 'inbox')}>
                          <div className={`flex items-center justify-between rounded px-2 py-1 text-[11px] transition ${isMailAccountMenuActive(account.id, 'inbox') ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'}`}>
                            <span>받은메일함</span>
                            {counts.inboxUnread > 0 ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                                <span className="animate-pulse text-[10px] leading-none text-amber-500">★</span>
                                <span>{counts.inboxUnread.toLocaleString('ko-KR')}</span>
                              </span>
                            ) : (
                              <span className="text-neutral-500">0</span>
                            )}
                          </div>
                        </Link>
                        <Link href={buildMailAccountHref(account.id, 'sent')}>
                          <div className={`flex items-center justify-between rounded px-2 py-1 text-[11px] transition ${isMailAccountMenuActive(account.id, 'sent') ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'}`}>
                            <span>보낸메일함</span>
                            <span>{counts.sent.toLocaleString('ko-KR')}</span>
                          </div>
                        </Link>
                        <Link href={buildMailAccountHref(account.id, 'trash')}>
                          <div className={`flex items-center justify-between rounded px-2 py-1 text-[11px] transition ${isMailAccountMenuActive(account.id, 'trash') ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'}`}>
                            <span>휴지통</span>
                            <span>{counts.trash.toLocaleString('ko-KR')}</span>
                          </div>
                        </Link>
                      </div>
                    ) : null}
                  </div>
                )
              })}
              <p className="mt-2 px-2 text-[10px] font-semibold text-neutral-500">개인계정</p>
              {mailAccounts.filter((account) => account.account_scope === 'personal').map((account) => {
                const active = pathname === '/client/mail/inbox' && searchParams.get('account_id') === String(account.id)
                const isOpen = Boolean(expandedMailAccounts[account.id]) || active
                const counts = mailAccountCounts[account.id] || { all: 0, inboxUnread: 0, sent: 0, trash: 0 }
                return (
                  <div key={`personal-${account.id}`} className="rounded-md border border-neutral-200">
                    <button
                      type="button"
                      onClick={() => setExpandedMailAccounts((prev) => ({ ...prev, [account.id]: !isOpen }))}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-[11px] transition ${
                        active ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'
                      }`}
                      title={account.email}
                    >
                      <span className="truncate">{account.email}</span>
                      <div className="flex items-center gap-1">
                        {counts.inboxUnread > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            <span className="animate-pulse text-[10px] leading-none text-amber-500">★</span>
                            <span>{counts.inboxUnread.toLocaleString('ko-KR')}</span>
                          </span>
                        ) : (
                          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600">0</span>
                        )}
                        <span className="text-[10px]">{isOpen ? '▾' : '▸'}</span>
                      </div>
                    </button>
                    {isOpen ? (
                      <div className="space-y-0.5 border-t border-neutral-200 bg-white px-2 py-1.5">
                        <Link href={buildMailAccountHref(account.id, 'all')}>
                          <div className={`flex items-center justify-between rounded px-2 py-1 text-[11px] transition ${isMailAccountMenuActive(account.id, 'all') ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'}`}>
                            <span>전체메일</span>
                            <span>{counts.all.toLocaleString('ko-KR')}</span>
                          </div>
                        </Link>
                        <Link href={buildMailAccountHref(account.id, 'inbox')}>
                          <div className={`flex items-center justify-between rounded px-2 py-1 text-[11px] transition ${isMailAccountMenuActive(account.id, 'inbox') ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'}`}>
                            <span>받은메일함</span>
                            {counts.inboxUnread > 0 ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                                <span className="animate-pulse text-[10px] leading-none text-amber-500">★</span>
                                <span>{counts.inboxUnread.toLocaleString('ko-KR')}</span>
                              </span>
                            ) : (
                              <span className="text-neutral-500">0</span>
                            )}
                          </div>
                        </Link>
                        <Link href={buildMailAccountHref(account.id, 'sent')}>
                          <div className={`flex items-center justify-between rounded px-2 py-1 text-[11px] transition ${isMailAccountMenuActive(account.id, 'sent') ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'}`}>
                            <span>보낸메일함</span>
                            <span>{counts.sent.toLocaleString('ko-KR')}</span>
                          </div>
                        </Link>
                        <Link href={buildMailAccountHref(account.id, 'trash')}>
                          <div className={`flex items-center justify-between rounded px-2 py-1 text-[11px] transition ${isMailAccountMenuActive(account.id, 'trash') ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'}`}>
                            <span>휴지통</span>
                            <span>{counts.trash.toLocaleString('ko-KR')}</span>
                          </div>
                        </Link>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="pt-2 rounded-lg border border-neutral-200 bg-white">
          <button
            type="button"
            onClick={() => setIsCompanyManagementOpen((prev) => !prev)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
              hasCompanyManagementPath ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            <span>거래처관리</span>
            <span aria-hidden>{isCompanyManagementOpen ? '▾' : '▸'}</span>
          </button>
          {isCompanyManagementOpen && (
            <div className="space-y-1 border-t border-neutral-200 px-2 py-2">
              {companyManagementMenus.map((menu) => {
                const active =
                  menu.href === '/client/companies/new'
                    ? pathname === menu.href
                    : pathname === menu.href ||
                      (pathname.startsWith('/client/companies/') && !pathname.startsWith('/client/companies/new'))
                return (
                  <Link key={menu.href} href={menu.href}>
                    <div
                      className={`rounded-md px-3 py-2 text-xs transition ${
                        active ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      {menu.label}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div className="pt-2 rounded-lg border border-neutral-200 bg-white">
          <button
            type="button"
            onClick={() => setIsStaffManagementOpen((prev) => !prev)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
              hasStaffManagementPath ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            <span>인사관리</span>
            <span aria-hidden>{isStaffManagementOpen ? '▾' : '▸'}</span>
          </button>
          {isStaffManagementOpen && (
            <div className="space-y-1 border-t border-neutral-200 px-2 py-2">
              {staffManagementMenus.map((menu) => {
                const active = pathname === menu.href
                return (
                  <Link key={menu.href} href={menu.href}>
                    <div
                      className={`rounded-md px-3 py-2 text-xs transition ${
                        active ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      {menu.label}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div className="pt-2 rounded-lg border border-neutral-200 bg-white">
          <button
            type="button"
            onClick={() => setIsBookkeepingOpen((prev) => !prev)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
              hasBookkeepingPath ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            <span>기장 관리</span>
            <span aria-hidden>{isBookkeepingOpen ? '▾' : '▸'}</span>
          </button>
          {isBookkeepingOpen && (
            <div className="space-y-1 border-t border-neutral-200 px-2 py-2">
              {bookkeepingMenus.map((menu) => {
                const active =
                  pathname === menu.href ||
                  (menu.href === '/client/bookkeeping/debits' && pathname.startsWith('/client/bookkeeping/debits'))
                return (
                  <Link key={menu.href} href={menu.href}>
                    <div
                      className={`rounded-md px-3 py-2 text-xs transition ${
                        active ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      {menu.label}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div className="pt-2 rounded-lg border border-neutral-200 bg-white">
          <button
            type="button"
            onClick={() => setIsSettingOpen((prev) => !prev)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
              hasSettingPath ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            <span>설정</span>
            <span aria-hidden>{isSettingOpen ? '▾' : '▸'}</span>
          </button>
          {isSettingOpen && (
            <div className="space-y-1 border-t border-neutral-200 px-2 py-2">
              {settingMenus.map((menu) => {
                const active = pathname === menu.href
                return (
                  <Link key={menu.href} href={menu.href}>
                    <div
                      className={`rounded-md px-3 py-2 text-xs transition ${
                        active ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      {menu.label}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {!loading && canManageClients ? (
          <div className="pt-2 rounded-lg border border-neutral-200 bg-white">
            <button
              type="button"
              onClick={() => setIsClientManagementOpen((prev) => !prev)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                hasClientManagementPath ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <span>클라이언트 관리</span>
              <span aria-hidden>{isClientManagementOpen ? '▾' : '▸'}</span>
            </button>
            {isClientManagementOpen && (
              <div className="space-y-1 border-t border-neutral-200 px-2 py-2">
                {clientManagementMenus.map((menu) => {
                  const active =
                    pathname === menu.href ||
                    (menu.href === '/client/client-management/blog/list' &&
                      pathname.startsWith('/client/client-management/blog/') &&
                      !pathname.startsWith('/client/client-management/blog/create'))
                  return (
                    <Link key={menu.href} href={menu.href}>
                      <div
                        className={`rounded-md px-3 py-2 text-xs transition ${
                          active ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'
                        }`}
                      >
                        {menu.label}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        ) : null}
        </div>
      </nav>
    </aside>
  )
}
