'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Mail, Mails, SendHorizontal, SquarePen, Settings, Trash2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { logoutClient } from '@/services/client/clientAuthService'
import {
  createMailFolder,
  deleteMailFolder,
  listMailAccounts,
  listMailFolders,
  listMailMessages,
  updateMailFolder,
} from '@/services/client/clientMailService'
import { fetchClientStaffSignupRequests } from '@/services/client/clientStaffSignupRequestService'
import { clearClientAccessToken } from '@/services/http'
import { useClientSessionContext } from '@/contexts/ClientSessionContext'
import { getClientRoleRank } from '@/utils/roleRank'
import { MAIL_COUNTS_REFRESH_EVENT } from '@/utils/mailSidebarEvents'
import { STAFF_SIGNUP_COUNTS_REFRESH_EVENT } from '@/utils/staffSignupEvents'

const menus = [
  { label: '대시보드', href: '/client/dashboard' },
]

const mailMenus = [
  { label: '메일쓰기', href: '/client/mail/compose' },
  { label: '메일설정', href: '/client/mail/accounts' },
]

const companyManagementMenus = [
  { label: '고객사 일정', href: '/client/schedule' },
  { label: '고객사 기본사항', href: '/client/companies' },
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
  { label: '동의약관 관리', href: '/client/client-management/consent-terms' },
  { label: '메일운영대시보드', href: '/client/client-management/mail-ops-dashboard' },
  { label: '블로그 목록', href: '/client/client-management/blog/list' },
  { label: 'GPT', href: '/client/client-management/gpt' },
]

const bookkeepingMenus = [
  { label: '기장 고객사 관리', href: '/client/bookkeeping/contracts' },
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
  const Icon = href === '/client/mail/compose' ? SquarePen : Settings
  return (
    <span className="inline-flex items-center justify-center gap-1.5">
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </span>
  )
}

export default function ClientSidebar({ collapsed = false, onToggleCollapse }: ClientSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const hasMailPath = pathname.startsWith('/client/mail')
  const hasCompanyManagementPath = pathname.startsWith('/client/companies') || pathname.startsWith('/client/schedule')
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
  const [mailFoldersByAccount, setMailFoldersByAccount] = useState<Record<number, Array<{ id: number; name: string }>>>({})
  const [expandedMailAccounts, setExpandedMailAccounts] = useState<Record<number, boolean>>({})
  const [mailCountsRefreshTick, setMailCountsRefreshTick] = useState(0)
  const [folderCreateTargetAccountId, setFolderCreateTargetAccountId] = useState<number | null>(null)
  const [folderCreateName, setFolderCreateName] = useState('')
  const [folderCreateLoading, setFolderCreateLoading] = useState(false)
  const [folderCreateError, setFolderCreateError] = useState<string | null>(null)
  const [folderEditTarget, setFolderEditTarget] = useState<{ accountId: number; folderId: number; name: string } | null>(null)
  const [folderEditName, setFolderEditName] = useState('')
  const [folderEditLoading, setFolderEditLoading] = useState(false)
  const [folderDeleteLoadingKey, setFolderDeleteLoadingKey] = useState<string | null>(null)
  const [folderActionMenuKey, setFolderActionMenuKey] = useState<string | null>(null)
  const [pendingSignupCount, setPendingSignupCount] = useState(0)
  const selectedMailAccountId = useMemo(() => {
    const raw = Number(searchParams.get('account_id') || '')
    return Number.isFinite(raw) && raw > 0 ? raw : null
  }, [searchParams])
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
  const buildMailFolderHref = (accountId: number, folderName: string) =>
    `/client/mail/inbox?mailbox=custom&account_id=${accountId}&folder=${encodeURIComponent(folderName)}`

  const isMailAccountMenuActive = (accountId: number, mailbox: 'all' | 'inbox' | 'sent' | 'trash') =>
    pathname === '/client/mail/inbox' &&
    searchParams.get('account_id') === String(accountId) &&
    searchParams.get('mailbox') === mailbox

  const isMailFolderMenuActive = (accountId: number, folderName: string) =>
    pathname === '/client/mail/inbox' &&
    searchParams.get('account_id') === String(accountId) &&
    searchParams.get('mailbox') === 'custom' &&
    searchParams.get('folder') === folderName

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
    if (!selectedMailAccountId) return
    setExpandedMailAccounts((prev) => (prev[selectedMailAccountId] ? prev : { ...prev, [selectedMailAccountId]: true }))
  }, [selectedMailAccountId])

  useEffect(() => {
    const refresh = () => setMailCountsRefreshTick((prev) => prev + 1)
    window.addEventListener(MAIL_COUNTS_REFRESH_EVENT, refresh)
    return () => window.removeEventListener(MAIL_COUNTS_REFRESH_EVENT, refresh)
  }, [])

  useEffect(() => {
    if (!folderActionMenuKey) return

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-folder-action-root="true"]')) return
      setFolderActionMenuKey(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFolderActionMenuKey(null)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [folderActionMenuKey])

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

        const unreadResults = await Promise.all(
          accounts.map(async (account) => {
            try {
              const inboxUnreadRes = await listMailMessages({
                page: 1,
                size: 1,
                mail_account_id: account.id,
                mailbox_type: 'inbox',
                is_read: false,
              })
              return [account.id, inboxUnreadRes.total ?? 0] as const
            } catch {
              return [account.id, 0] as const
            }
          })
        )

        const detailedTargetIds = accounts
          .filter((account) => Boolean(expandedMailAccounts[account.id]) || account.id === selectedMailAccountId)
          .map((account) => account.id)

        const detailedResults = await Promise.all(
          detailedTargetIds.map(async (accountId) => {
            try {
              const [allRes, sentRes, trashRes, folderRes] = await Promise.all([
                listMailMessages({ page: 1, size: 1, mail_account_id: accountId }),
                listMailMessages({ page: 1, size: 1, mail_account_id: accountId, direction: 'outbound' }),
                listMailMessages({ page: 1, size: 1, mail_account_id: accountId, include_trash: true }),
                listMailFolders(true, accountId),
              ])
              return {
                accountId,
                all: allRes.total ?? 0,
                sent: sentRes.total ?? 0,
                trash: trashRes.total ?? 0,
                folders: (folderRes.items || [])
                  .map((item) => ({ id: item.id, name: item.name }))
                  .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
              }
            } catch {
              return { accountId, all: 0, sent: 0, trash: 0, folders: [] as Array<{ id: number; name: string }> }
            }
          })
        )

        const unreadMap = new Map(unreadResults)
        const detailedMap = new Map(detailedResults.map((item) => [item.accountId, item] as const))

        const nextCounts: Record<number, { all: number; inboxUnread: number; sent: number; trash: number }> = {}
        const nextFolders: Record<number, Array<{ id: number; name: string }>> = {}
        await Promise.all(
          accounts.map(async (account) => {
            const previous = mailAccountCounts[account.id] || { all: 0, inboxUnread: 0, sent: 0, trash: 0 }
            const detailed = detailedMap.get(account.id)
            nextCounts[account.id] = {
              all: detailed?.all ?? previous.all,
              inboxUnread: unreadMap.get(account.id) ?? 0,
              sent: detailed?.sent ?? previous.sent,
              trash: detailed?.trash ?? previous.trash,
            }
            nextFolders[account.id] = detailed?.folders ?? mailFoldersByAccount[account.id] ?? []
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
  }, [session, loading, mailCountsRefreshTick, expandedMailAccounts, selectedMailAccountId])

  useEffect(() => {
    if (loading || !session) {
      setPendingSignupCount(0)
      return
    }

    let cancelled = false
    const loadPendingSignupCount = async () => {
      try {
        const res = await fetchClientStaffSignupRequests('pending')
        if (!cancelled) setPendingSignupCount(res.total ?? 0)
      } catch {
        if (!cancelled) setPendingSignupCount(0)
      }
    }

    void loadPendingSignupCount()
    window.addEventListener('focus', loadPendingSignupCount)
    window.addEventListener(STAFF_SIGNUP_COUNTS_REFRESH_EVENT, loadPendingSignupCount)
    return () => {
      cancelled = true
      window.removeEventListener('focus', loadPendingSignupCount)
      window.removeEventListener(STAFF_SIGNUP_COUNTS_REFRESH_EVENT, loadPendingSignupCount)
    }
  }, [loading, pathname, session])

  const mailTopMenus = mailMenus.filter((menu) => menu.href !== '/client/mail/accounts')
  const mailSettingMenu = mailMenus.find((menu) => menu.href === '/client/mail/accounts') || null

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
    } catch (error) {
      const detail = (error as any)?.response?.data?.detail
      setFolderCreateError(typeof detail === 'string' && detail.trim() ? detail : '폴더 생성에 실패했습니다.')
    } finally {
      setFolderCreateLoading(false)
    }
  }

  const reloadFoldersForAccount = async (accountId: number) => {
    const folderRes = await listMailFolders(true, accountId)
    setMailFoldersByAccount((prev) => ({
      ...prev,
      [accountId]: (folderRes.items || [])
        .map((item) => ({ id: item.id, name: item.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    }))
  }

  const handleStartFolderEdit = (accountId: number, folderId: number, name: string) => {
    setFolderActionMenuKey(null)
    setFolderEditTarget({ accountId, folderId, name })
    setFolderEditName(name)
  }

  const handleCancelFolderEdit = () => {
    setFolderEditTarget(null)
    setFolderEditName('')
  }

  const handleSubmitFolderEdit = async () => {
    if (!folderEditTarget) return
    const trimmed = folderEditName.trim()
    if (!trimmed) {
      toast.error('폴더 이름을 입력해 주세요.')
      return
    }
    try {
      setFolderEditLoading(true)
      await updateMailFolder(folderEditTarget.folderId, { name: trimmed })
      await reloadFoldersForAccount(folderEditTarget.accountId)
      if (
        pathname === '/client/mail/inbox' &&
        searchParams.get('mailbox') === 'custom' &&
        searchParams.get('account_id') === String(folderEditTarget.accountId) &&
        searchParams.get('folder') === folderEditTarget.name
      ) {
        const nextParams = new URLSearchParams(searchParams.toString())
        nextParams.set('folder', trimmed)
        router.replace(`${pathname}?${nextParams.toString()}`)
      }
      window.dispatchEvent(new CustomEvent(MAIL_COUNTS_REFRESH_EVENT))
      toast.success('폴더명을 변경했습니다.')
      handleCancelFolderEdit()
    } catch {
      toast.error('폴더명 변경에 실패했습니다.')
    } finally {
      setFolderEditLoading(false)
    }
  }

  const handleDeleteFolder = async (accountId: number, folderId: number, folderName: string) => {
    if (!window.confirm(`"${folderName}" 폴더를 삭제할까요?\n폴더 내 메일은 받은메일함으로 이동됩니다.`)) return
    const key = `${accountId}-${folderId}`
    try {
      setFolderDeleteLoadingKey(key)
      await deleteMailFolder(folderId)
      await reloadFoldersForAccount(accountId)
      if (
        pathname === '/client/mail/inbox' &&
        searchParams.get('mailbox') === 'custom' &&
        searchParams.get('account_id') === String(accountId) &&
        searchParams.get('folder') === folderName
      ) {
        router.replace(buildMailAccountHref(accountId, 'inbox'))
      }
      window.dispatchEvent(new CustomEvent(MAIL_COUNTS_REFRESH_EVENT))
      toast.success('폴더를 삭제했습니다.')
      setFolderActionMenuKey(null)
      if (folderEditTarget?.folderId === folderId) {
        handleCancelFolderEdit()
      }
    } catch {
      toast.error('폴더 삭제에 실패했습니다.')
    } finally {
      setFolderDeleteLoadingKey(null)
    }
  }

  const renderFolderRows = (accountId: number) =>
    (mailFoldersByAccount[accountId] || []).map((folder) => {
      const isEditing =
        folderEditTarget?.accountId === accountId && folderEditTarget.folderId === folder.id
      const folderKey = `${accountId}-${folder.id}`
      if (isEditing) {
        return (
          <div key={folder.id} className="ml-4 mt-1 space-y-1 rounded border border-neutral-200 bg-neutral-50 p-2">
            <input
              value={folderEditName}
              onChange={(e) => setFolderEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleSubmitFolderEdit()
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  handleCancelFolderEdit()
                }
              }}
              placeholder="폴더 이름"
              className="h-7 w-full rounded border border-neutral-300 bg-white px-2 text-[11px] text-neutral-900 outline-none focus:border-neutral-500"
              autoFocus
            />
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={handleCancelFolderEdit}
                className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[10px] text-neutral-700 hover:bg-neutral-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleSubmitFolderEdit()}
                disabled={folderEditLoading}
                className="rounded border border-neutral-900 bg-neutral-900 px-2 py-0.5 text-[10px] text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {folderEditLoading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        )
      }
      return (
        <div key={folder.id} className="group ml-4 flex items-center gap-1">
          <Link href={buildMailFolderHref(accountId, folder.name)} className="min-w-0 flex-1">
            <div
              className={`flex items-center justify-between rounded px-2 py-1 text-[11px] transition ${
                isMailFolderMenuActive(accountId, folder.name)
                  ? 'bg-neutral-100 font-medium text-neutral-900'
                  : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <span className="truncate">{folder.name}</span>
            </div>
          </Link>
          <div className="relative" data-folder-action-root="true">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setFolderActionMenuKey((prev) => (prev === folderKey ? null : folderKey))
              }}
              className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[10px] text-neutral-600 opacity-0 transition group-hover:opacity-100 hover:bg-neutral-50"
              aria-label="폴더 메뉴"
            >
              ⋯
            </button>
            {folderActionMenuKey === folderKey ? (
              <div className="absolute right-0 top-6 z-20 min-w-20 rounded-md border border-neutral-200 bg-white p-1 shadow-md">
                <button
                  type="button"
                  onClick={() => handleStartFolderEdit(accountId, folder.id, folder.name)}
                  className="block w-full rounded px-2 py-1 text-left text-[11px] text-neutral-700 hover:bg-neutral-50"
                >
                  이름 변경
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteFolder(accountId, folder.id, folder.name)}
                  disabled={folderDeleteLoadingKey === folderKey}
                  className="block w-full rounded px-2 py-1 text-left text-[11px] text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                >
                  {folderDeleteLoadingKey === folderKey ? '삭제중' : '삭제'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )
    })

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
        <div className="flex flex-col gap-1">
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

        <div className="order-2 pt-2 rounded-lg border border-neutral-200 bg-white">
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
              <div className="grid grid-cols-1 gap-2">
                {mailTopMenus.map((menu) => (
                  <Link key={menu.href} href={menu.href}>
                    <div
                      className={`rounded-md border px-3 py-2 text-center text-xs transition ${
                        isMenuActive(pathname, searchParams, menu.href)
                          ? 'border-neutral-900 bg-neutral-900 font-medium text-white'
                          : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      <MailActionMenuLabel href={menu.href} label={menu.label} />
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
                        {renderFolderRows(account.id)}
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
                        {renderFolderRows(account.id)}
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
              {mailSettingMenu ? (
                <>
                  <div className="my-2 border-t border-neutral-200" />
                  <Link href={mailSettingMenu.href}>
                    <div
                      className={`rounded-md border px-3 py-2 text-center text-xs transition ${
                        isMenuActive(pathname, searchParams, mailSettingMenu.href)
                          ? 'border-neutral-900 bg-neutral-900 font-medium text-white'
                          : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      <MailActionMenuLabel href={mailSettingMenu.href} label={mailSettingMenu.label} />
                    </div>
                  </Link>
                </>
              ) : null}
            </div>
          )}
        </div>

        <div className="order-3 pt-2 rounded-lg border border-neutral-200 bg-white">
          <button
            type="button"
            onClick={() => setIsCompanyManagementOpen((prev) => !prev)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
              hasCompanyManagementPath ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            <span>외부업무(고객사)</span>
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

        <div className="order-1 pt-2 rounded-lg border border-neutral-200 bg-white">
          <button
            type="button"
            onClick={() => setIsStaffManagementOpen((prev) => !prev)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
              hasStaffManagementPath ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            <span>내부업무</span>
            <span aria-hidden>{isStaffManagementOpen ? '▾' : '▸'}</span>
          </button>
          {isStaffManagementOpen && (
            <div className="space-y-1 border-t border-neutral-200 px-2 py-2">
              {staffManagementMenus.map((menu) => {
                const active = pathname === menu.href
                const showSignupBadge = menu.href === '/client/staff/signup-requests' && pendingSignupCount > 0
                return (
                  <Link key={menu.href} href={menu.href}>
                    <div
                      className={`rounded-md px-3 py-2 text-xs transition ${
                        active ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{menu.label}</span>
                        {showSignupBadge ? (
                          <span className="shrink-0 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                            {pendingSignupCount.toLocaleString('ko-KR')}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div className="order-4 pt-2 rounded-lg border border-neutral-200 bg-white">
          <button
            type="button"
            onClick={() => setIsBookkeepingOpen((prev) => !prev)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
              hasBookkeepingPath ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            <span>외부업무(기장)</span>
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

        <div className="order-5 pt-2 rounded-lg border border-neutral-200 bg-white">
          <button
            type="button"
            onClick={() => setIsSettingOpen((prev) => !prev)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
              hasSettingPath ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            <span>내 정보</span>
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
          <div className="order-6 pt-2 rounded-lg border border-neutral-200 bg-white">
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
