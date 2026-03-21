'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  Briefcase,
  Building2,
  ClipboardList,
  FolderOpen,
  LayoutDashboard,
  Mail,
  Mails,
  SendHorizontal,
  Settings,
  SquarePen,
  Trash2,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  createMailFolder,
  deleteMailFolder,
  listMailAccounts,
  listMailFolders,
  listMailMessages,
  updateMailFolder,
} from '@/services/admin/mailService'
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
    key: 'leave',
    label: '내부업무',
    children: [
      { label: '휴가/근태관리', href: '/admin/staff/attendance' },
      { label: '프로필', href: '/admin/staff/profile' },
      { label: '전자문서', href: '/admin/staff/documents' },
      { label: '업무지시', href: '/admin/staff/work-posts?post_type=task' },
    ],
  },
  {
    key: 'board',
    label: '게시판',
    children: [{ label: '공지사항', href: '/admin/staff/work-posts?post_type=notice' }],
  },
  { key: 'docs', label: '문서함', href: '/admin/docs' },
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
    label: '외부업무',
    children: [
      { label: '기본관리', href: '/admin/companies' },
      { label: '원천세관리', href: '/admin/company-withholding/business' },
      { label: '고객사 일정', href: '/admin/tax-schedule' },
    ],
  },
]

function getActiveSection(pathname: string, searchParams: URLSearchParams): string {
  if (pathname.startsWith('/admin/staff/work-posts')) {
    const postType = (searchParams.get('post_type') || '').toLowerCase()
    return postType === 'task' ? 'leave' : 'board'
  }
  if (pathname.startsWith('/admin/staff')) return 'leave'
  if (pathname.startsWith('/admin/mail')) return 'mail'
  if (pathname.startsWith('/admin/docs')) return 'docs'
  if (pathname.startsWith('/admin/companies')) return 'companies'
  if (pathname.startsWith('/admin/company-withholding')) return 'companies'
  if (pathname.startsWith('/admin/tax-schedule')) return 'companies'
  if (pathname.startsWith('/admin/dashboard')) return 'dashboard'
  return ''
}

function isChildActive(pathname: string, searchParams: URLSearchParams, href: string): boolean {
  if (href === '/admin/company-withholding/business' && pathname.startsWith('/admin/company-withholding')) {
    return true
  }
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

function getSectionIcon(key: string) {
  if (key === 'dashboard') return LayoutDashboard
  if (key === 'leave') return Briefcase
  if (key === 'board') return ClipboardList
  if (key === 'docs') return FolderOpen
  if (key === 'mail') return Mail
  if (key === 'companies') return Building2
  return Briefcase
}

export default function Sidebar({ collapsed = false, onToggleCollapse }: AdminSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { session, loading: sessionLoading } = useAdminSessionContext()

  const [activeRailSection, setActiveRailSection] = useState<'dashboard' | 'leave' | 'board' | 'docs' | 'mail' | 'companies'>('dashboard')
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
  const shouldHideSecondSidebar = activeRailSection === 'board' || activeRailSection === 'docs'
  const selectedMailAccountId = useMemo(() => {
    const raw = Number(searchParams.get('account_id') || '')
    return Number.isFinite(raw) && raw > 0 ? raw : null
  }, [searchParams])

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
    const activeKey = getActiveSection(pathname, searchParams)
    if (!activeKey) return
    setActiveRailSection(activeKey as 'dashboard' | 'leave' | 'board' | 'docs' | 'mail' | 'companies')
  }, [pathname, searchParams])

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
          .filter((account) => (expandedMailAccounts[account.id] ?? true) || account.id === selectedMailAccountId)
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
  }, [session, sessionLoading, mailCountsRefreshTick, expandedMailAccounts, selectedMailAccountId])

  const activeSection = getActiveSection(pathname, searchParams)
  const userRoleLevel = session ? getAdminRoleRank(session) : 99
  const hasUserSession = Boolean(session)
  const collapsedQuickMenus = [
    {
      key: 'dashboard',
      label: '대시',
      href: '/admin/dashboard',
      icon: LayoutDashboard,
      active: activeSection === 'dashboard',
    },
    {
      key: 'leave',
      label: '내부',
      href: '/admin/staff/attendance',
      icon: Briefcase,
      active: activeSection === 'leave',
    },
    {
      key: 'board',
      label: '게시판',
      href: '/admin/staff/work-posts?post_type=notice',
      icon: ClipboardList,
      active: activeSection === 'board',
    },
    {
      key: 'docs',
      label: '문서함',
      href: '/admin/docs',
      icon: FolderOpen,
      active: activeSection === 'docs',
    },
    {
      key: 'mail',
      label: '메일',
      href: '/admin/mail/inbox',
      icon: Mail,
      active: activeSection === 'mail',
    },
    {
      key: 'companies',
      label: '외부',
      href: '/admin/companies',
      icon: Building2,
      active: activeSection === 'companies',
    },
  ] as const

  const handleOpenSectionFromRail = (sectionKey: string, href: string) => {
    const key = sectionKey as 'dashboard' | 'leave' | 'board' | 'docs' | 'mail' | 'companies'

    // 같은 아이콘 재클릭:
    // - 2단 열림 상태면 닫기(페이지 유지)
    // - 2단 닫힘 상태면 열기(페이지 유지)
    if (key === activeRailSection) {
      onToggleCollapse?.()
      return
    }

    setActiveRailSection(key)
    if (key === 'mail') {
      router.push(buildDefaultMailLandingHref())
    } else {
      router.push(href)
    }
    if (collapsed) onToggleCollapse?.()
  }

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

  function buildDefaultMailLandingHref() {
    const companyAccount = mailAccounts.find((account) => account.account_scope === 'company')
    if (companyAccount) return buildMailAccountHref(companyAccount.id, 'all')
    if (mailAccounts.length > 0) return buildMailAccountHref(mailAccounts[0].id, 'all')
    return '/admin/mail/inbox'
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
        pathname === '/admin/mail/inbox' &&
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
        pathname === '/admin/mail/inbox' &&
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
                className="rounded border border-sky-600 bg-sky-600 px-2 py-0.5 text-[10px] text-white hover:bg-sky-700 disabled:opacity-50"
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

  const sectionsToRender = menuSections.filter((section) => section.key === activeRailSection)

  return (
    <aside className={`flex h-full border-r border-neutral-200 bg-white ${collapsed || shouldHideSecondSidebar ? 'w-14' : 'w-full'}`}>
      <div className="flex h-full w-14 flex-col border-r border-neutral-200 bg-white">
        <nav className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
          <div className="space-y-1">
            {collapsedQuickMenus.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  type="button"
                  title={item.label}
                  onClick={() => handleOpenSectionFromRail(item.key, item.href)}
                  className={`mx-auto flex w-12 flex-col items-center justify-center rounded-md px-1 py-2 text-center transition ${
                    activeRailSection === item.key
                      ? 'bg-sky-600 text-white'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="mt-1 text-[9px] leading-3">{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      </div>
      {!collapsed && !shouldHideSecondSidebar ? (
      <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-xs font-medium text-neutral-500">메뉴</p>
        </div>
        <div className="space-y-1">
          {sectionsToRender.map((section) => {
            const isActiveSection = activeSection === section.key
            const hasChildren = Boolean(section.children?.length)
            const SectionIcon = getSectionIcon(section.key)

            if (!hasChildren && section.href) {
              return (
                <Link key={section.key} href={section.href}>
                  <div
                    className={`rounded-lg px-3 py-2 text-sm transition ${
                      isActiveSection ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <SectionIcon className="h-4 w-4" />
                      <span>{section.label}</span>
                    </span>
                  </div>
                </Link>
              )
            }

            const visibleChildren = section.children?.filter((child) => {
              if (child.href === '/admin/setting/role' && userRoleLevel >= 2) return false
              if (child.href === '/admin/companies/account' && !hasUserSession) {
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
              <div
                key={section.key}
                className="rounded-lg bg-white"
              >
                <div className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-neutral-700">
                  <span className="inline-flex items-center gap-2">
                    <SectionIcon className="h-4 w-4" />
                    <span>{section.label}</span>
                  </span>
                </div>
                <div className="space-y-1 px-2 py-2">
                    {section.key === 'mail' ? (
                      <div className="grid grid-cols-1 gap-2">
                        {mailTopChildren.map((child) => (
                          <Link key={child.href} href={child.href}>
                            <div
                              className={`rounded-md px-3 py-2 text-center text-xs transition ${
                                isChildActive(pathname, searchParams, child.href)
                                  ? 'bg-sky-600 font-medium text-white'
                                  : 'bg-neutral-50/70 text-neutral-700 hover:bg-neutral-100'
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
                        <div className="my-1 h-1" />
                        <p className="px-2 text-[10px] font-semibold text-neutral-500">법인계정</p>
                        {mailAccounts.filter((account) => account.account_scope === 'company').map((account) => {
                          const active = pathname === '/admin/mail/inbox' && searchParams.get('account_id') === String(account.id)
                          const isOpen = (expandedMailAccounts[account.id] ?? true) || active
                          const counts = mailAccountCounts[account.id] || { all: 0, inboxUnread: 0, sent: 0, trash: 0 }
                          return (
                            <div key={`company-${account.id}`} className="rounded-md bg-neutral-50/40">
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
                                <div className="space-y-0.5 bg-white/80 px-2 py-1.5">
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
                          const active = pathname === '/admin/mail/inbox' && searchParams.get('account_id') === String(account.id)
                          const isOpen = (expandedMailAccounts[account.id] ?? true) || active
                          const counts = mailAccountCounts[account.id] || { all: 0, inboxUnread: 0, sent: 0, trash: 0 }
                          return (
                            <div key={`personal-${account.id}`} className="rounded-md bg-neutral-50/40">
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
                                <div className="space-y-0.5 bg-white/80 px-2 py-1.5">
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
                                        className="inline-flex h-4 w-4 items-center justify-center rounded text-[10px] text-neutral-600 hover:bg-neutral-100"
                                        aria-label="폴더 만들기"
                                      >
                                        +
                                      </button>
                                      <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity duration-150 delay-1000 group-hover:opacity-100">
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
                                          className="rounded border border-sky-600 bg-sky-600 px-2 py-0.5 text-[10px] text-white hover:bg-sky-700 disabled:opacity-50"
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
                        {mailSettingChild ? (
                          <>
                            <div className="my-1 h-1" />
                            <Link href={mailSettingChild.href}>
                              <div
                                className={`rounded-md px-3 py-2 text-center text-xs transition ${
                                  isChildActive(pathname, searchParams, mailSettingChild.href)
                                    ? 'bg-sky-600 font-medium text-white'
                                    : 'bg-neutral-50/70 text-neutral-700 hover:bg-neutral-100'
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
              </div>
            )
          })}
        </div>
      </nav>
      ) : null}
    </aside>
  )
}
