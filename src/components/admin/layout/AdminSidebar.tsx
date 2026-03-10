'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Mail, Mails, SendHorizontal, SquarePen, Settings, Trash2 } from 'lucide-react'
import { checkOutAdmin, getAttendanceLogs } from '@/services/admin/attendanceLogService'
import { logoutAdmin } from '@/services/admin/adminService'
import { createMailFolder, listMailAccounts, listMailFolders, listMailMessages } from '@/services/admin/mailService'
import { format } from 'date-fns'
import { clearAdminAccessToken } from '@/services/http'
import { useAdminSessionContext } from '@/contexts/AdminSessionContext'
import { filterAdminVisibleMailAccounts } from '@/utils/mailAccountScope'
import { getAdminRoleRank } from '@/utils/roleRank'
import { MAIL_COUNTS_REFRESH_EVENT } from '@/utils/mailSidebarEvents'

type MenuChild = { label: string; href: string }
type MenuSection = {
  key: string
  label: string
  href?: string
  children?: MenuChild[]
}

type AdminSidebarProps = {
  collapsed?: boolean
  onToggleCollapse?: () => void
}

const menuSections: MenuSection[] = [
  { key: 'dashboard', label: '대시보드', href: '/admin/dashboard' },
  {
    key: 'mail',
    label: '메일',
    children: [
      { label: '메일작성', href: '/admin/mail/compose' },
      { label: '메일설정', href: '/admin/mail/accounts' },
    ],
  },
  {
    key: 'companies',
    label: '고객사 관리',
    children: [
      { label: '고객사 리스트', href: '/admin/companies' },
    ],
  },
  {
    key: 'schedule',
    label: '일정 관리',
    children: [
      { label: '거래처 일정', href: '/admin/tax-schedule' },
    ],
  },
  {
    key: 'leave',
    label: '마이페이지',
    children: [
      { label: '내휴가관리', href: '/admin/staff/my-leave' },
      { label: '프로필', href: '/admin/staff/profile' },
      { label: '내 결재문서', href: '/admin/staff/documents' },
      { label: '문서작성', href: '/admin/staff/documents/new' },
      { label: '출퇴근 관리', href: '/admin/staff/attendance' },
    ],
  },
  {
    key: 'company-withholding',
    label: '고객사 원천세',
    children: [
      { label: '사업신고', href: '/admin/company-withholding/business' },
      { label: '근로소득신고', href: '/admin/company-withholding/earned-income' },
      { label: '기타신고', href: '/admin/company-withholding/etc' },
    ],
  },
  { key: 'gpt', label: 'GPT', href: '/admin/gpt' },
  {
    key: 'setting',
    label: '설정',
    children: [
      { label: '부서 관리', href: '/admin/setting/department' },
      { label: '팀 관리', href: '/admin/setting/team' },
      { label: '직급 관리', href: '/admin/setting/role' },
    ],
  },
]

function getActiveSection(pathname: string): string {
  if (pathname.startsWith('/admin/mail')) return 'mail'
  if (pathname.startsWith('/admin/companies')) return 'companies'
  if (pathname.startsWith('/admin/tax-schedule')) return 'schedule'
  if (pathname.startsWith('/admin/staff')) return 'leave'
  if (pathname.startsWith('/admin/company-withholding')) return 'company-withholding'
  if (pathname.startsWith('/admin/gpt')) return 'gpt'
  if (pathname.startsWith('/admin/setting')) return 'setting'
  if (pathname.startsWith('/admin/dashboard')) return 'dashboard'
  return ''
}

function isChildActive(pathname: string, searchParams: URLSearchParams, href: string): boolean {
  const [targetPath, queryString] = href.split('?')
  if (pathname !== targetPath) return false
  if (!queryString) return true
  const targetQuery = new URLSearchParams(queryString)
  for (const [key, value] of targetQuery.entries()) {
    if (searchParams.get(key) !== value) {
      return false
    }
  }
  return true
}

function MailboxMenuLabel({ type, label }: { type: 'all' | 'inbox' | 'sent' | 'trash'; label: string }) {
  const Icon = type === 'all' ? Mails : type === 'inbox' ? Mail : type === 'sent' ? SendHorizontal : Trash2
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </span>
  )
}

function MailActionMenuLabel({ href, label }: { href: string; label: string }) {
  const Icon = href === '/admin/mail/compose' ? SquarePen : Settings
  return (
    <span className="inline-flex items-center justify-center gap-1.5">
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </span>
  )
}

export default function Sidebar({ collapsed = false, onToggleCollapse }: AdminSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { session, loading: sessionLoading } = useAdminSessionContext()

  const [user, setUser] = useState<{
    id: number
    name: string
    companyName?: string
    profile_image_url?: string
    checkIn?: string
    roleLevel?: number
    roleName?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState<string>(() =>
    new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  )
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [mailAccounts, setMailAccounts] = useState<Array<{ id: number; email: string; account_scope: 'company' | 'personal' }>>([])
  const [mailAccountCounts, setMailAccountCounts] = useState<Record<number, { all: number; inboxUnread: number; sent: number; trash: number }>>({})
  const [mailFoldersByAccount, setMailFoldersByAccount] = useState<Record<number, Array<{ id: number; name: string }>>>({})
  const [expandedMailAccounts, setExpandedMailAccounts] = useState<Record<number, boolean>>({})
  const [mailCountsRefreshTick, setMailCountsRefreshTick] = useState(0)
  const [folderCreateTargetAccountId, setFolderCreateTargetAccountId] = useState<number | null>(null)
  const [folderCreateName, setFolderCreateName] = useState('')
  const [folderCreateLoading, setFolderCreateLoading] = useState(false)
  const [folderCreateError, setFolderCreateError] = useState<string | null>(null)

  const buildMailAccountHref = (accountId: number, mailbox: 'all' | 'inbox' | 'sent' | 'trash') =>
    `/admin/mail/inbox?mailbox=${mailbox}&account_id=${accountId}`
  const buildMailFolderHref = (accountId: number, folderName: string) =>
    `/admin/mail/inbox?mailbox=custom&account_id=${accountId}&folder=${encodeURIComponent(folderName)}`

  const isMailAccountMenuActive = (accountId: number, mailbox: 'all' | 'inbox' | 'sent' | 'trash') =>
    pathname === '/admin/mail/inbox' &&
    searchParams.get('account_id') === String(accountId) &&
    searchParams.get('mailbox') === mailbox

  const isMailFolderMenuActive = (accountId: number, folderName: string) =>
    pathname === '/admin/mail/inbox' &&
    searchParams.get('account_id') === String(accountId) &&
    searchParams.get('mailbox') === 'custom' &&
    searchParams.get('folder') === folderName

  useEffect(() => {
    async function fetchAttendance() {
      if (sessionLoading) return
      if (!session) {
        setUser(null)
        setErrorMessage('사용자 정보를 불러오지 못했습니다.')
        setLoading(false)
        return
      }

      const sessionAccountId = (session as any).account_id ?? (session as any).id
      if (typeof sessionAccountId !== 'number') {
        setUser(null)
        setErrorMessage('사용자 정보를 불러오지 못했습니다.')
        setLoading(false)
        return
      }

      if (!user) {
        setLoading(true)
      }
      setErrorMessage(null)
      setUser({
        id: sessionAccountId,
        name: session.name,
        companyName:
          (session as any).client?.company_name ??
          (session as any).company_name ??
          (session as any).client_name,
        profile_image_url: typeof (session as any).profile_image_url === 'string'
          ? (session as any).profile_image_url
          : undefined,
        roleName: (session as any).role_name ?? (session as any).role?.name,
        roleLevel: getAdminRoleRank(session),
        checkIn: undefined,
      })

      try {
        const today = format(new Date(), 'yyyy-MM-dd')
        const attendanceRes = await getAttendanceLogs({ date_to: today, limit: 1, offset: 0 })
        const todayCheckIn = attendanceRes.items?.[0]?.check_in || null

        if (todayCheckIn) {
          setUser((prev) =>
            prev
              ? {
                  ...prev,
                  checkIn: new Date(todayCheckIn).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                }
              : prev
          )
        }
      } catch (attendanceError) {
        console.warn('근태 정보 조회 실패:', attendanceError)
      }
      setLoading(false)
    }
    fetchAttendance()

    const timeInterval = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      )
    }, 1000)

    return () => clearInterval(timeInterval)
  }, [session, sessionLoading])

  useEffect(() => {
    const activeKey = getActiveSection(pathname)
    if (!activeKey) return
    setExpanded((prev) => ({ ...prev, [activeKey]: true }))
  }, [pathname])

  useEffect(() => {
    const selectedAccountId = Number(searchParams.get('account_id') || '')
    if (!Number.isFinite(selectedAccountId) || selectedAccountId <= 0) return
    setExpandedMailAccounts((prev) => (prev[selectedAccountId] ? prev : { ...prev, [selectedAccountId]: true }))
  }, [searchParams])

  useEffect(() => {
    const refresh = () => setMailCountsRefreshTick((prev) => prev + 1)
    window.addEventListener(MAIL_COUNTS_REFRESH_EVENT, refresh)
    return () => window.removeEventListener(MAIL_COUNTS_REFRESH_EVENT, refresh)
  }, [])

  useEffect(() => {
    if (sessionLoading || !session) return

    const loadMailCounts = async () => {
      try {
        const accountRes = await listMailAccounts(true)
        const visibleAccounts = filterAdminVisibleMailAccounts(accountRes.items || [], session.id)
        const accounts = visibleAccounts.map((item) => ({
          id: item.id,
          email: item.email,
          account_scope: item.account_scope || 'company',
        }))
        setMailAccounts(accounts)

        const nextCounts: Record<number, { all: number; inboxUnread: number; sent: number; trash: number }> = {}
        const nextFolders: Record<number, Array<{ id: number; name: string }>> = {}
        await Promise.all(
          accounts.map(async (account) => {
            try {
              const [allRes, inboxUnreadRes, sentRes, trashRes, folderRes] = await Promise.all([
                listMailMessages({ page: 1, size: 1, mail_account_id: account.id }),
                listMailMessages({ page: 1, size: 1, mail_account_id: account.id, mailbox_type: 'inbox', is_read: false }),
                listMailMessages({ page: 1, size: 1, mail_account_id: account.id, direction: 'outbound' }),
                listMailMessages({ page: 1, size: 1, mail_account_id: account.id, include_trash: true }),
                listMailFolders(true, account.id),
              ])
              nextCounts[account.id] = {
                all: allRes.total ?? 0,
                inboxUnread: inboxUnreadRes.total ?? 0,
                sent: sentRes.total ?? 0,
                trash: trashRes.total ?? 0,
              }
              nextFolders[account.id] = (folderRes.items || [])
                .map((item) => ({ id: item.id, name: item.name }))
                .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
            } catch {
              nextCounts[account.id] = { all: 0, inboxUnread: 0, sent: 0, trash: 0 }
              nextFolders[account.id] = []
            }
          })
        )
        setMailAccountCounts(nextCounts)
        setMailFoldersByAccount(nextFolders)
      } catch {
        setMailAccounts([])
        setMailAccountCounts({})
        setMailFoldersByAccount({})
      }
    }

    void loadMailCounts()
  }, [session, sessionLoading, pathname, searchParams, mailCountsRefreshTick])

  const activeSection = getActiveSection(pathname)
  const sidebarTitle = user?.companyName ? `${user.companyName} 관리자` : '관리자'

  const handleOpenFolderCreate = (accountId: number) => {
    if (folderCreateTargetAccountId === accountId) {
      setFolderCreateTargetAccountId(null)
      setFolderCreateName('')
      setFolderCreateError(null)
      return
    }
    setFolderCreateTargetAccountId(accountId)
    setFolderCreateName('')
    setFolderCreateError(null)
  }

  const handleCancelFolderCreate = () => {
    setFolderCreateTargetAccountId(null)
    setFolderCreateName('')
    setFolderCreateError(null)
  }

  const handleSubmitFolderCreate = async (accountId: number) => {
    const trimmed = folderCreateName.trim()
    if (!trimmed) {
      setFolderCreateError('폴더 이름을 입력해 주세요.')
      return
    }
    const targetAccount = mailAccounts.find((account) => account.id === accountId)
    if (!targetAccount || targetAccount.account_scope !== 'personal') {
      setFolderCreateError('개인 계정에서만 폴더를 만들 수 있습니다.')
      return
    }
    try {
      setFolderCreateLoading(true)
      await createMailFolder({ name: trimmed, mail_account_id: accountId })
      const folderRes = await listMailFolders(true, accountId)
      setMailFoldersByAccount((prev) => ({
        ...prev,
        [accountId]: (folderRes.items || [])
          .map((item) => ({ id: item.id, name: item.name }))
          .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
      }))
      window.dispatchEvent(new CustomEvent(MAIL_COUNTS_REFRESH_EVENT))
      handleCancelFolderCreate()
    } catch {
      setFolderCreateError('폴더 생성에 실패했습니다.')
    } finally {
      setFolderCreateLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await checkOutAdmin()
    } catch (e) {
      console.warn('⚠️ 퇴근 기록 실패:', e)
    }

    await logoutAdmin()
    clearAdminAccessToken()
    router.push('/login/staff')
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
          <p className="text-xs text-neutral-500">{sidebarTitle}</p>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-neutral-300 text-neutral-700 transition hover:bg-neutral-50"
            aria-label="사이드바 접기"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
        {!user && loading ? (
          <>
            <div className="mt-2 h-4 w-36 animate-pulse rounded bg-neutral-100" />
            <div className="mt-2 h-3 w-40 animate-pulse rounded bg-neutral-100" />
          </>
        ) : user ? (
          <div className="mt-2">
            <div className="flex items-center gap-3">
              <img
                src={user.profile_image_url || '/default-profile.png'}
                alt="사용자 이미지"
                className="h-12 w-12 rounded-full border border-neutral-200 object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {user.name} {user.roleName || ''}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">출근시간: {user.checkIn ?? '-'}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-neutral-500">현재시간: {currentTime}</p>
              <button
                type="button"
                onClick={handleLogout}
                className="h-6 rounded-md bg-neutral-900 px-2 text-[11px] font-medium text-white hover:bg-neutral-800"
              >
                로그아웃
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-rose-600">{errorMessage ?? '사용자 정보가 없습니다.'}</p>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <p className="px-1 pb-2 text-xs font-medium text-neutral-500">메뉴</p>
        <div className="space-y-1">
          {menuSections.map((section) => {
            const isActiveSection = activeSection === section.key
            const hasChildren = Boolean(section.children?.length)

            if (!hasChildren && section.href) {
              return (
                <Link key={section.key} href={section.href}>
                  <div
                    className={`rounded-lg px-3 py-2 text-sm transition ${
                      isActiveSection ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    {section.label}
                  </div>
                </Link>
              )
            }

            const isOpen = Boolean(expanded[section.key])
            const visibleChildren = section.children?.filter((child) => {
              if (child.href === '/admin/setting/role' && (user?.roleLevel ?? 99) >= 2) return false
              if (child.href === '/admin/companies/account' && !user) {
                return false
              }
              return true
            }) ?? []
            const mailTopChildren =
              section.key === 'mail'
                ? visibleChildren.filter((child) => child.href !== '/admin/mail/accounts')
                : visibleChildren
            const mailSettingChild =
              section.key === 'mail'
                ? visibleChildren.find((child) => child.href === '/admin/mail/accounts') || null
                : null

            if (visibleChildren.length === 0) {
              return null
            }

            return (
              <div key={section.key} className="rounded-lg border border-neutral-200 bg-white">
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [section.key]: !isOpen }))}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                    isActiveSection ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <span>{section.label}</span>
                  <span className="text-xs">{isOpen ? '▾' : '▸'}</span>
                </button>
                {isOpen ? (
                  <div className="space-y-1 border-t border-neutral-200 px-2 py-2">
                    {section.key === 'mail' ? (
                      <div className="grid grid-cols-1 gap-2">
                        {mailTopChildren.map((child) => (
                          <Link key={child.href} href={child.href}>
                            <div
                              className={`rounded-md border px-3 py-2 text-center text-xs transition ${
                                isChildActive(pathname, searchParams, child.href)
                                  ? 'border-neutral-900 bg-neutral-900 font-medium text-white'
                                  : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                              }`}
                            >
                              <MailActionMenuLabel href={child.href} label={child.label} />
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      visibleChildren.map((child) => (
                        <Link key={child.href} href={child.href}>
                          <div
                            className={`rounded-md px-3 py-2 text-xs transition ${
                              isChildActive(pathname, searchParams, child.href)
                                ? 'bg-neutral-100 font-medium text-neutral-900'
                                : 'text-neutral-600 hover:bg-neutral-50'
                            }`}
                          >
                            {child.label}
                          </div>
                        </Link>
                      ))
                    )}
                    {section.key === 'mail' ? (
                      <>
                        <div className="my-2 border-t border-neutral-200" />
                        <p className="px-2 text-[10px] font-semibold text-neutral-500">법인계정</p>
                        {mailAccounts.filter((account) => account.account_scope === 'company').map((account) => {
                          const active = pathname === '/admin/mail/inbox' && searchParams.get('account_id') === String(account.id)
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
                                      <MailboxMenuLabel type="all" label="전체메일" />
                                      <span>{counts.all.toLocaleString('ko-KR')}</span>
                                    </div>
                                  </Link>
                                  <Link href={buildMailAccountHref(account.id, 'inbox')}>
                                    <div className={`flex items-center justify-between rounded px-2 py-1 text-[11px] transition ${isMailAccountMenuActive(account.id, 'inbox') ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'}`}>
                                      <MailboxMenuLabel type="inbox" label="받은메일함" />
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
                                  {(mailFoldersByAccount[account.id] || []).map((folder) => (
                                    <Link key={folder.id} href={buildMailFolderHref(account.id, folder.name)}>
                                      <div className={`ml-4 flex items-center justify-between rounded px-2 py-1 text-[11px] transition ${isMailFolderMenuActive(account.id, folder.name) ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'}`}>
                                        <span className="truncate">{folder.name}</span>
                                      </div>
                                    </Link>
                                  ))}
                                  <Link href={buildMailAccountHref(account.id, 'sent')}>
                                    <div className={`flex items-center justify-between rounded px-2 py-1 text-[11px] transition ${isMailAccountMenuActive(account.id, 'sent') ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'}`}>
                                      <MailboxMenuLabel type="sent" label="보낸메일함" />
                                      <span>{counts.sent.toLocaleString('ko-KR')}</span>
                                    </div>
                                  </Link>
                                  <Link href={buildMailAccountHref(account.id, 'trash')}>
                                    <div className={`flex items-center justify-between rounded px-2 py-1 text-[11px] transition ${isMailAccountMenuActive(account.id, 'trash') ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'}`}>
                                      <MailboxMenuLabel type="trash" label="휴지통" />
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
                          const active = pathname === '/admin/mail/inbox' && searchParams.get('account_id') === String(account.id)
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
                                      <MailboxMenuLabel type="all" label="전체메일" />
                                      <span>{counts.all.toLocaleString('ko-KR')}</span>
                                    </div>
                                  </Link>
                                  <div className="flex items-center gap-1">
                                    <Link href={buildMailAccountHref(account.id, 'inbox')} className="min-w-0 flex-1">
                                      <div className={`flex items-center justify-between rounded px-2 py-1 text-[11px] transition ${isMailAccountMenuActive(account.id, 'inbox') ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'}`}>
                                        <MailboxMenuLabel type="inbox" label="받은메일함" />
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
                                    <div className="group relative">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenFolderCreate(account.id)}
                                        className="inline-flex h-4 w-4 items-center justify-center rounded border border-neutral-300 text-[10px] text-neutral-600 hover:bg-neutral-50"
                                        aria-label="폴더 만들기"
                                      >
                                        +
                                      </button>
                                      <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity duration-150 delay-1000 group-hover:opacity-100">
                                        폴더 만들기
                                      </span>
                                    </div>
                                  </div>
                                  {folderCreateTargetAccountId === account.id ? (
                                    <div className="ml-4 mt-1 space-y-1 rounded border border-neutral-200 bg-neutral-50 p-2">
                                      <input
                                        value={folderCreateName}
                                        onChange={(e) => {
                                          setFolderCreateName(e.target.value)
                                          if (folderCreateError) setFolderCreateError(null)
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault()
                                            void handleSubmitFolderCreate(account.id)
                                          }
                                          if (e.key === 'Escape') {
                                            e.preventDefault()
                                            handleCancelFolderCreate()
                                          }
                                        }}
                                        placeholder="폴더 이름"
                                        className="h-7 w-full rounded border border-neutral-300 bg-white px-2 text-[11px] text-neutral-900 outline-none focus:border-neutral-500"
                                        autoFocus
                                      />
                                      {folderCreateError ? <p className="text-[10px] text-rose-600">{folderCreateError}</p> : null}
                                      <div className="flex items-center justify-end gap-1">
                                        <button
                                          type="button"
                                          onClick={handleCancelFolderCreate}
                                          className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[10px] text-neutral-700 hover:bg-neutral-50"
                                        >
                                          취소
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void handleSubmitFolderCreate(account.id)}
                                          disabled={folderCreateLoading}
                                          className="rounded border border-neutral-900 bg-neutral-900 px-2 py-0.5 text-[10px] text-white hover:bg-neutral-800 disabled:opacity-50"
                                        >
                                          {folderCreateLoading ? '저장 중...' : '저장'}
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}
                                  {(mailFoldersByAccount[account.id] || []).map((folder) => (
                                    <Link key={folder.id} href={buildMailFolderHref(account.id, folder.name)}>
                                      <div className={`ml-4 flex items-center justify-between rounded px-2 py-1 text-[11px] transition ${isMailFolderMenuActive(account.id, folder.name) ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'}`}>
                                        <span className="truncate">{folder.name}</span>
                                      </div>
                                    </Link>
                                  ))}
                                  <Link href={buildMailAccountHref(account.id, 'sent')}>
                                    <div className={`flex items-center justify-between rounded px-2 py-1 text-[11px] transition ${isMailAccountMenuActive(account.id, 'sent') ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'}`}>
                                      <MailboxMenuLabel type="sent" label="보낸메일함" />
                                      <span>{counts.sent.toLocaleString('ko-KR')}</span>
                                    </div>
                                  </Link>
                                  <Link href={buildMailAccountHref(account.id, 'trash')}>
                                    <div className={`flex items-center justify-between rounded px-2 py-1 text-[11px] transition ${isMailAccountMenuActive(account.id, 'trash') ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'}`}>
                                      <MailboxMenuLabel type="trash" label="휴지통" />
                                      <span>{counts.trash.toLocaleString('ko-KR')}</span>
                                    </div>
                                  </Link>
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                        {mailSettingChild ? (
                          <>
                            <div className="my-2 border-t border-neutral-200" />
                            <Link href={mailSettingChild.href}>
                              <div
                                className={`rounded-md border px-3 py-2 text-center text-xs transition ${
                                  isChildActive(pathname, searchParams, mailSettingChild.href)
                                    ? 'border-neutral-900 bg-neutral-900 font-medium text-white'
                                    : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                                }`}
                              >
                                <MailActionMenuLabel href={mailSettingChild.href} label={mailSettingChild.label} />
                              </div>
                            </Link>
                          </>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </nav>
    </aside>
  )
}
