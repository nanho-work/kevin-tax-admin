'use client'

import { useEffect, useState, type FormEvent } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { formatKSTDateTime, formatKSTDateTimeAssumeUTC } from '@/utils/dateTime'
import {
  cancelMailAccountInitialSync,
  createMailFolder,
  createMailRule,
  createMailAccount,
  deleteMailFolder,
  deleteMailRule,
  deleteMailAccount,
  getMailAccountInitialSyncStatus,
  getClientMailErrorMessage,
  listMailActionLogs,
  listMailFolders,
  listMailAccounts,
  listMailRules,
  listMailSyncLogs,
  startGoogleOAuth,
  startMailAccountInitialSync,
  testMailAccountConnection,
  updateMailAccount,
} from '@/services/client/clientMailService'
import type { MailAccount, MailAccountScopeType, MailAuthType, MailFolder, MailProviderType, MailRule } from '@/types/adminMail'

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

type MailDomainOption = 'gmail' | 'outlook' | 'naver' | 'daum' | 'gabia' | 'hiworks' | 'custom'
type ReceiveProtocol = 'imap' | 'pop3'

const mailDomainOptions: Array<{ label: string; value: MailDomainOption }> = [
  { label: 'Gmail', value: 'gmail' },
  { label: 'Outlook', value: 'outlook' },
  { label: 'Naver', value: 'naver' },
  { label: 'Daum', value: 'daum' },
  { label: 'Gabia', value: 'gabia' },
  { label: 'Hiworks', value: 'hiworks' },
  { label: '기타', value: 'custom' },
]

const authOptions: Array<{ label: string; value: MailAuthType }> = [
  { label: '앱 비밀번호', value: 'app_password' },
  { label: '일반 비밀번호', value: 'password' },
]

const getProviderTypeFromDomain = (domain: MailDomainOption): MailProviderType => {
  if (domain === 'custom' || domain === 'hiworks' || domain === 'daum') return 'custom'
  return domain
}

const getDomainDisplayText = (domain: MailDomainOption) => {
  if (domain === 'gmail') return 'gmail.com'
  if (domain === 'outlook') return 'outlook.com / office365.com'
  if (domain === 'naver') return 'naver.com'
  if (domain === 'daum') return 'daum.net / hanmail.net'
  if (domain === 'gabia') return 'gabia.com'
  if (domain === 'hiworks') return 'hiworks.com'
  return ''
}

const inferDomainOptionFromAccount = (account: MailAccount): MailDomainOption => {
  const host = (account.imap_host || '').toLowerCase()
  if (host.includes('hiworks') || host.includes('pop3')) return 'hiworks'
  if (account.provider_type === 'gmail') return 'gmail'
  if (account.provider_type === 'outlook') return 'outlook'
  if (account.provider_type === 'naver') return 'naver'
  if (account.provider_type === 'gabia') return 'gabia'
  if (host.includes('daum') || host.includes('hanmail')) return 'daum'
  return 'custom'
}

function getInitialSyncStatusLabel(status?: string) {
  if (status === 'running') return '진행중'
  if (status === 'completed') return '완료'
  if (status === 'failed') return '실패'
  if (status === 'canceled') return '중지됨'
  return '대기'
}

function getRuleMatchFieldLabel(field: MailRule['match_field']) {
  if (field === 'from_email') return '보낸 사람'
  if (field === 'subject') return '제목'
  if (field === 'snippet') return '본문'
  if (field === 'to_email') return '받는 사람'
  if (field === 'cc_email') return '참조자'
  return field
}

function getRuleMatchOperatorLabel(operator: MailRule['match_operator']) {
  if (operator === 'contains') return '포함'
  if (operator === 'equals') return '일치'
  if (operator === 'starts_with') return '시작'
  if (operator === 'ends_with') return '끝'
  return operator
}

const FIXED_SYNC_INTERVAL_MINUTES = 10
const FIXED_INITIAL_SYNC_BATCH_SIZE = 50

export default function ClientMailAccountsPage() {
  const [accounts, setAccounts] = useState<MailAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [oauthConnecting, setOauthConnecting] = useState(false)
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null)
  const [testingId, setTestingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [initialSyncStartingId, setInitialSyncStartingId] = useState<number | null>(null)
  const [initialSyncCancelingId, setInitialSyncCancelingId] = useState<number | null>(null)
  const [initialSyncRefreshingId, setInitialSyncRefreshingId] = useState<number | null>(null)
  const [apiNotice, setApiNotice] = useState<string | null>(null)
  const [folders, setFolders] = useState<MailFolder[]>([])
  const [rules, setRules] = useState<MailRule[]>([])
  const [syncLogs, setSyncLogs] = useState<Array<{ id: number; status: string; synced_count: number; started_at: string }>>([])
  const [actionLogs, setActionLogs] = useState<Array<{ id: number; action: string; actor_type: string; created_at: string; detail?: string | null }>>([])
  const [folderNameInput, setFolderNameInput] = useState('')
  const [ruleNameInput, setRuleNameInput] = useState('')
  const [ruleMatchField, setRuleMatchField] = useState<'from_email' | 'subject' | 'snippet' | 'to_email' | 'cc_email'>('from_email')
  const [ruleMatchOperator, setRuleMatchOperator] = useState<'contains' | 'equals' | 'starts_with' | 'ends_with'>('contains')
  const [ruleMatchValue, setRuleMatchValue] = useState('')
  const [ruleTargetFolderId, setRuleTargetFolderId] = useState<number | ''>('')
  const [ruleTargetCompanyId, setRuleTargetCompanyId] = useState('')
  const [ruleMailAccountId, setRuleMailAccountId] = useState<number | ''>('')
  const [rulePriority, setRulePriority] = useState('100')
  const [ruleStopProcessing, setRuleStopProcessing] = useState(true)
  const [folderSubmitting, setFolderSubmitting] = useState(false)
  const [ruleSubmitting, setRuleSubmitting] = useState(false)
  const [ruleDeletingId, setRuleDeletingId] = useState<number | null>(null)
  const [folderDeletingId, setFolderDeletingId] = useState<number | null>(null)
  const [accountScopeFilter, setAccountScopeFilter] = useState<'' | MailAccountScopeType>('')
  const [initialSyncTargetCount, setInitialSyncTargetCount] = useState('5000')

  const [mailDomain, setMailDomain] = useState<MailDomainOption>('custom')
  const [receiveProtocol, setReceiveProtocol] = useState<ReceiveProtocol>('imap')
  const [providerType, setProviderType] = useState<MailProviderType>('custom')
  const [accountScope, setAccountScope] = useState<MailAccountScopeType>('company')
  const [customDomain, setCustomDomain] = useState('')
  const [authType, setAuthType] = useState<MailAuthType>('app_password')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [imapHost, setImapHost] = useState('')
  const [imapPort, setImapPort] = useState('993')
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState('465')
  const [appPassword, setAppPassword] = useState('')
  const [accountPassword, setAccountPassword] = useState('')

  const resetForm = () => {
    setEditingAccountId(null)
    setMailDomain('custom')
    setReceiveProtocol('imap')
    setProviderType('custom')
    setAccountScope('company')
    setCustomDomain('')
    setAuthType('app_password')
    setEmail('')
    setDisplayName('')
    setImapHost('')
    setImapPort('993')
    setSmtpHost('')
    setSmtpPort('465')
    setAppPassword('')
    setAccountPassword('')
  }

  const applyDomainPreset = (domain: MailDomainOption, protocol: ReceiveProtocol) => {
    setMailDomain(domain)
    const nextProtocol = domain === 'hiworks' ? 'pop3' : domain === 'gmail' ? 'imap' : protocol
    setReceiveProtocol(nextProtocol)
    setProviderType(getProviderTypeFromDomain(domain))
    if (domain === 'custom') {
      if (authType === 'oauth') setAuthType('app_password')
      return
    }
    if (domain === 'daum') {
      setAuthType('app_password')
      setImapHost(nextProtocol === 'pop3' ? 'pop.daum.net' : 'imap.daum.net')
      setImapPort(nextProtocol === 'pop3' ? '995' : '993')
      setSmtpHost('smtp.daum.net')
      setSmtpPort(nextProtocol === 'imap' ? '587' : '465')
      return
    }
    if (domain === 'gmail') {
      setAuthType('oauth')
      setImapHost('imap.gmail.com')
      setImapPort('993')
      setSmtpHost('smtp.gmail.com')
      setSmtpPort('587')
      setAppPassword('')
      setAccountPassword('')
      return
    }
    if (domain === 'naver') {
      setAuthType('app_password')
      setImapHost(nextProtocol === 'pop3' ? 'pop.naver.com' : 'imap.naver.com')
      setImapPort(nextProtocol === 'pop3' ? '995' : '993')
      setSmtpHost('smtp.naver.com')
      setSmtpPort(nextProtocol === 'imap' ? '587' : '465')
      return
    }
    if (domain === 'gabia') {
      setAuthType('app_password')
      setImapHost('mail.gabia.com')
      setImapPort('993')
      setSmtpHost('mail.gabia.com')
      setSmtpPort('465')
      return
    }
    if (domain === 'outlook') {
      setAuthType('app_password')
      setImapHost('outlook.office365.com')
      setImapPort(nextProtocol === 'pop3' ? '995' : '993')
      setSmtpHost('smtp.office365.com')
      setSmtpPort('587')
      return
    }
    setAuthType('app_password')
    setImapHost('pop3s.hiworks.com')
    setImapPort('995')
    setSmtpHost('smtps.hiworks.com')
    setSmtpPort('465')
  }

  const loadAccounts = async () => {
    try {
      setLoading(true)
      const res = await listMailAccounts(true, accountScopeFilter || undefined)
      setAccounts(res.items || [])
      setApiNotice(null)
    } catch (error) {
      const message = getClientMailErrorMessage(error)
      setApiNotice(message)
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }

  const loadRuleAndFolderData = async () => {
    try {
      const [folderRes, ruleRes, syncLogRes, actionLogRes] = await Promise.all([
        listMailFolders(true),
        listMailRules({ is_active: true }),
        listMailSyncLogs({ page: 1, size: 10 }),
        listMailActionLogs({ page: 1, size: 10 }),
      ])
      setFolders(folderRes.items || [])
      setRules(ruleRes.items || [])
      setSyncLogs((syncLogRes.items || []).map((item) => ({
        id: item.id,
        status: item.status,
        synced_count: item.synced_count,
        started_at: item.started_at,
      })))
      setActionLogs((actionLogRes.items || []).map((item) => ({
        id: item.id,
        action: item.action,
        actor_type: item.actor_type,
        created_at: item.created_at,
        detail: item.detail,
      })))
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    }
  }

  useEffect(() => {
    loadAccounts()
    loadRuleAndFolderData()
  }, [])

  useEffect(() => {
    loadAccounts()
  }, [accountScopeFilter])

  const patchAccountInitialSyncStatus = (accountId: number, patch: Partial<MailAccount>) => {
    setAccounts((prev) => prev.map((item) => (item.id === accountId ? { ...item, ...patch } : item)))
  }

  useEffect(() => {
    const runningIds = accounts.filter((item) => item.initial_sync_status === 'running').map((item) => item.id)
    if (runningIds.length === 0) return
    const timer = window.setInterval(() => {
      runningIds.forEach((id) => {
        void handleRefreshInitialSyncStatus(id, true)
      })
    }, 12000)
    return () => window.clearInterval(timer)
  }, [accounts])

  const getGoogleOAuthErrorMessage = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 400) return '연동이 만료되었어요. 다시 시도해 주세요.'
      if (error.response?.status === 409) return '이미 다른 개인 소유로 등록된 계정입니다.'
      if (error.response?.status === 500) return '서버 설정 문제입니다. 관리자에게 문의해 주세요.'
    }
    return getClientMailErrorMessage(error)
  }

  const handleCreateAccount = async (e: FormEvent) => {
    e.preventDefault()
    if (mailDomain === 'gmail') {
      toast.error('Google로 연동 버튼을 사용해 주세요.')
      return
    }
    if (!email.trim()) {
      toast.error('메일 주소를 입력해 주세요.')
      return
    }
    try {
      setSubmitting(true)
      const passwordOrAppSecret =
        authType === 'app_password'
          ? appPassword.trim() || undefined
          : authType === 'password'
            ? accountPassword.trim() || undefined
            : undefined
      const payload = {
        account_scope: accountScope,
        provider_type: providerType,
        auth_type: authType,
        email: email.trim(),
        display_name: displayName.trim() || undefined,
        imap_host: imapHost.trim() || undefined,
        imap_port: imapPort.trim() ? Number(imapPort) : undefined,
        smtp_host: smtpHost.trim() || undefined,
        smtp_port: smtpPort.trim() ? Number(smtpPort) : undefined,
        password_or_app_secret: passwordOrAppSecret,
        sync_interval_minutes: FIXED_SYNC_INTERVAL_MINUTES,
      }
      if (editingAccountId) {
        await updateMailAccount(editingAccountId, payload)
        toast.success('메일 계정을 수정했습니다.')
      } else {
        await createMailAccount(payload)
        toast.success('메일 계정을 등록했습니다.')
      }
      resetForm()
      await loadAccounts()
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartGoogleOAuth = async () => {
    try {
      setOauthConnecting(true)
      const res = await startGoogleOAuth({
        account_scope: accountScope,
        sync_enabled: true,
        sync_interval_minutes: FIXED_SYNC_INTERVAL_MINUTES,
      })
      if (!res.authorize_url) {
        toast.error('Google 인증 URL을 가져오지 못했습니다.')
        return
      }
      window.location.href = res.authorize_url
    } catch (error) {
      toast.error(getGoogleOAuthErrorMessage(error))
    } finally {
      setOauthConnecting(false)
    }
  }

  const handleTestConnection = async (accountId: number) => {
    try {
      setTestingId(accountId)
      const res = await testMailAccountConnection(accountId)
      toast.success(`IMAP ${res.imap_ok ? 'OK' : 'FAIL'} / SMTP ${res.smtp_ok ? 'OK' : 'FAIL'}`)
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    } finally {
      setTestingId(null)
    }
  }

  const handleStartInitialSync = async (accountId: number) => {
    const targetCount = Number(initialSyncTargetCount)
    if (!Number.isFinite(targetCount) || targetCount <= 0) {
      toast.error('목표 수집 건수를 확인해 주세요.')
      return
    }
    try {
      setInitialSyncStartingId(accountId)
      const res = await startMailAccountInitialSync(accountId, {
        target_count: targetCount,
        batch_size: FIXED_INITIAL_SYNC_BATCH_SIZE,
      })
      patchAccountInitialSyncStatus(accountId, {
        initial_sync_status: res.initial_sync_status,
        initial_sync_started_at: res.initial_sync_started_at ?? null,
        initial_sync_finished_at: res.initial_sync_finished_at ?? null,
        initial_sync_target_count: res.initial_sync_target_count ?? null,
        initial_sync_fetched_count: res.initial_sync_fetched_count ?? 0,
        initial_sync_batch_size: res.initial_sync_batch_size ?? null,
        initial_sync_cursor_uid: res.initial_sync_cursor_uid ?? null,
        initial_sync_error_message: res.initial_sync_error_message ?? null,
      })
      toast.success(res.message || '초기 동기화를 시작했습니다.')
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    } finally {
      setInitialSyncStartingId(null)
    }
  }

  const handleRefreshInitialSyncStatus = async (accountId: number, silent = false) => {
    try {
      setInitialSyncRefreshingId(accountId)
      const res = await getMailAccountInitialSyncStatus(accountId)
      patchAccountInitialSyncStatus(accountId, {
        initial_sync_status: res.initial_sync_status,
        initial_sync_started_at: res.initial_sync_started_at ?? null,
        initial_sync_finished_at: res.initial_sync_finished_at ?? null,
        initial_sync_target_count: res.initial_sync_target_count ?? null,
        initial_sync_fetched_count: res.initial_sync_fetched_count ?? 0,
        initial_sync_batch_size: res.initial_sync_batch_size ?? null,
        initial_sync_cursor_uid: res.initial_sync_cursor_uid ?? null,
        initial_sync_error_message: res.initial_sync_error_message ?? null,
      })
      if (!silent) {
        toast.success(res.message || '초기 동기화 상태를 조회했습니다.')
      }
    } catch (error) {
      if (!silent) {
        toast.error(getClientMailErrorMessage(error))
      }
    } finally {
      setInitialSyncRefreshingId(null)
    }
  }

  const handleCancelInitialSync = async (accountId: number) => {
    try {
      setInitialSyncCancelingId(accountId)
      const res = await cancelMailAccountInitialSync(accountId)
      patchAccountInitialSyncStatus(accountId, {
        initial_sync_status: res.initial_sync_status,
        initial_sync_started_at: res.initial_sync_started_at ?? null,
        initial_sync_finished_at: res.initial_sync_finished_at ?? null,
        initial_sync_target_count: res.initial_sync_target_count ?? null,
        initial_sync_fetched_count: res.initial_sync_fetched_count ?? 0,
        initial_sync_batch_size: res.initial_sync_batch_size ?? null,
        initial_sync_cursor_uid: res.initial_sync_cursor_uid ?? null,
        initial_sync_error_message: res.initial_sync_error_message ?? null,
      })
      toast.success(res.message || '초기 동기화를 중지했습니다.')
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    } finally {
      setInitialSyncCancelingId(null)
    }
  }

  const handleDeactivate = async (accountId: number) => {
    try {
      setDeletingId(accountId)
      await deleteMailAccount(accountId)
      toast.success('메일 계정을 비활성화했습니다.')
      await loadAccounts()
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    } finally {
      setDeletingId(null)
    }
  }

  const handleCreateFolder = async () => {
    if (!folderNameInput.trim()) {
      toast.error('폴더명을 입력해 주세요.')
      return
    }
    try {
      setFolderSubmitting(true)
      await createMailFolder({ name: folderNameInput.trim() })
      setFolderNameInput('')
      toast.success('폴더를 등록했습니다.')
      await loadRuleAndFolderData()
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    } finally {
      setFolderSubmitting(false)
    }
  }

  const handleCreateRule = async () => {
    if (!ruleNameInput.trim() || !ruleMatchValue.trim()) {
      toast.error('자동분류 이름과 찾을 내용을 입력해 주세요.')
      return
    }
    try {
      setRuleSubmitting(true)
      await createMailRule({
        name: ruleNameInput.trim(),
        match_field: ruleMatchField,
        match_operator: ruleMatchOperator,
        match_value: ruleMatchValue.trim(),
        mail_account_id: typeof ruleMailAccountId === 'number' ? ruleMailAccountId : undefined,
        priority: Number(rulePriority) || 100,
        target_folder_id: typeof ruleTargetFolderId === 'number' ? ruleTargetFolderId : undefined,
        target_company_id: ruleTargetCompanyId.trim() ? Number(ruleTargetCompanyId) : undefined,
        stop_processing: ruleStopProcessing,
      })
      setRuleNameInput('')
      setRuleMatchValue('')
      setRuleTargetCompanyId('')
      toast.success('자동분류를 추가했습니다.')
      await loadRuleAndFolderData()
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    } finally {
      setRuleSubmitting(false)
    }
  }

  const handleDeleteRule = async (ruleId: number) => {
    try {
      setRuleDeletingId(ruleId)
      await deleteMailRule(ruleId)
      toast.success('자동분류를 삭제했습니다.')
      await loadRuleAndFolderData()
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    } finally {
      setRuleDeletingId(null)
    }
  }

  const handleDeleteFolder = async (folderId: number) => {
    try {
      setFolderDeletingId(folderId)
      await deleteMailFolder(folderId)
      toast.success('폴더를 비활성화했습니다.')
      await loadRuleAndFolderData()
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    } finally {
      setFolderDeletingId(null)
    }
  }

  const handleEditAccount = (account: MailAccount) => {
    const inferredDomain = inferDomainOptionFromAccount(account)
    const inferredProtocol: ReceiveProtocol =
      (account.imap_host || '').toLowerCase().includes('pop') ? 'pop3' : 'imap'
    setEditingAccountId(account.id)
    setAccountScope((account.account_scope || 'company') as MailAccountScopeType)
    setMailDomain(inferredDomain)
    setReceiveProtocol(inferredProtocol)
    setProviderType(getProviderTypeFromDomain(inferredDomain))
    setCustomDomain(inferredDomain === 'custom' ? account.imap_host || '' : '')
    setAuthType(account.auth_type as MailAuthType)
    setEmail(account.email || '')
    setDisplayName(account.display_name || '')
    setImapHost(account.imap_host || '')
    setImapPort(account.imap_port ? String(account.imap_port) : '')
    setSmtpHost(account.smtp_host || '')
    setSmtpPort(account.smtp_port ? String(account.smtp_port) : '')
    setAppPassword('')
    setAccountPassword('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const domainDisplayValue = mailDomain === 'custom' ? customDomain : getDomainDisplayText(mailDomain)
  const receiveProtocolLabel = receiveProtocol === 'imap' ? 'IMAP' : 'POP3'
  const isGoogleOAuthMode = mailDomain === 'gmail'

  return (
    <section className="space-y-4">
      {apiNotice ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {apiNotice}
        </div>
      ) : null}

      <form onSubmit={handleCreateAccount} className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">{editingAccountId ? `메일 계정 수정 #${editingAccountId}` : '메일 계정 등록'}</h2>
          {editingAccountId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              수정 취소
            </button>
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr]">
          <div className="space-y-3 rounded-lg border border-zinc-200 p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs text-zinc-600">계정 범위</p>
                <select className={inputClass} value={accountScope} onChange={(e) => setAccountScope(e.target.value as MailAccountScopeType)}>
                  <option value="company">회사 공용 계정</option>
                  <option value="personal">개인 계정</option>
                </select>
              </div>
              <div>
                <p className="mb-1 text-xs text-zinc-600">메일 도메인</p>
                <select className={inputClass} value={mailDomain} onChange={(e) => applyDomainPreset(e.target.value as MailDomainOption, receiveProtocol)}>
                  {mailDomainOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              {!isGoogleOAuthMode ? (
                <>
                  <select
                    className={inputClass}
                    value={receiveProtocol}
                    onChange={(e) => {
                      const nextProtocol = e.target.value as ReceiveProtocol
                      setReceiveProtocol(nextProtocol)
                      if (mailDomain !== 'custom' && mailDomain !== 'hiworks') {
                        applyDomainPreset(mailDomain, nextProtocol)
                      }
                    }}
                    disabled={mailDomain === 'hiworks'}
                  >
                    <option value="imap">IMAP/SMTP (권장)</option>
                    <option value="pop3">POP3/SMTP</option>
                  </select>
                  <input
                    className={`${inputClass} ${mailDomain === 'custom' ? '' : 'bg-zinc-100 text-zinc-600'}`}
                    value={domainDisplayValue}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="기타 도메인 입력"
                    disabled={mailDomain !== 'custom'}
                  />
                  <div>
                    <p className="mb-1 text-xs text-zinc-600">인증 방식</p>
                    <select className={inputClass} value={authType} onChange={(e) => setAuthType(e.target.value as MailAuthType)}>
                      {authOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-zinc-600">메일 주소</p>
                    <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="예: user@domain.com" />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-zinc-600">표시 이름</p>
                    <input className={inputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="예: 홍길동" />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-zinc-600">앱 비밀번호</p>
                    <input
                      className={`${inputClass} ${authType === 'app_password' ? '' : 'bg-zinc-100 text-zinc-500'}`}
                      value={appPassword}
                      onChange={(e) => setAppPassword(e.target.value)}
                      placeholder={authType === 'app_password' ? '앱 비밀번호 입력' : '인증방식을 앱 비밀번호로 선택하면 입력'}
                      disabled={authType !== 'app_password'}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-zinc-600">비밀번호</p>
                    <input
                      className={`${inputClass} ${authType === 'password' ? '' : 'bg-zinc-100 text-zinc-500'}`}
                      value={accountPassword}
                      onChange={(e) => setAccountPassword(e.target.value)}
                      placeholder={authType === 'password' ? '메일 로그인 비밀번호 입력' : '인증방식을 일반 비밀번호로 선택하면 입력'}
                      disabled={authType !== 'password'}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-zinc-600">일반 자동 동기화 주기 (고정)</p>
                    <input className={`${inputClass} bg-zinc-100 text-zinc-600`} value={`${FIXED_SYNC_INTERVAL_MINUTES}분`} disabled />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-zinc-600">초기 동기화 목표 건수 (과거 메일 양 기준 입력)</p>
                    <input
                      className={inputClass}
                      value={initialSyncTargetCount}
                      onChange={(e) => setInitialSyncTargetCount(e.target.value)}
                      placeholder="예: 1000 / 3000 / 5000"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-zinc-600">초기 동기화 배치 건수 (고정)</p>
                    <input className={`${inputClass} bg-zinc-100 text-zinc-600`} value={`${FIXED_INITIAL_SYNC_BATCH_SIZE}건`} disabled />
                  </div>
                </>
              ) : (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 md:col-span-2">
                  Gmail은 Google OAuth로만 연동됩니다. 아래 버튼으로 연결해 주세요.
                </div>
              )}
            </div>
            {!isGoogleOAuthMode ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs text-zinc-600">받는 메일 서버 ({receiveProtocolLabel})</p>
                  <input className={inputClass} value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="예: imap.naver.com / pop.naver.com" />
                </div>
                <div>
                  <p className="mb-1 text-xs text-zinc-600">받는 메일 포트</p>
                  <input className={inputClass} value={imapPort} onChange={(e) => setImapPort(e.target.value)} placeholder="예: 993 / 995" />
                </div>
                <div>
                  <p className="mb-1 text-xs text-zinc-600">보내는 메일 서버 (SMTP)</p>
                  <input className={inputClass} value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="예: smtp.naver.com" />
                </div>
                <div>
                  <p className="mb-1 text-xs text-zinc-600">보내는 메일 포트</p>
                  <input className={inputClass} value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="예: 465 / 587" />
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-semibold text-zinc-800">설정 안내</p>
            <p className="mt-2 text-xs text-zinc-600">연동 방식: <span className="font-medium text-zinc-800">{isGoogleOAuthMode ? 'Google OAuth' : `${receiveProtocolLabel} / SMTP`}</span></p>
            {!isGoogleOAuthMode ? (
              <>
                {mailDomain === 'hiworks' ? (
                  <p className="mt-1 text-xs text-zinc-600">Hiworks는 POP3/SMTP 조합을 권장합니다.</p>
                ) : null}
                <div className="mt-3 space-y-2 rounded-md border border-zinc-200 bg-white p-3 text-xs text-zinc-600">
                  <p className="font-medium text-zinc-700">대표 포트 참고</p>
                  <p>IMAP: 993(SSL)</p>
                  <p>POP3: 995(SSL)</p>
                  <p>SMTP: 465(SSL) 또는 587(TLS)</p>
                  <p className="text-[11px] text-zinc-500">메일사 정책에 따라 다를 수 있으니, 안내 문서를 우선으로 확인하세요.</p>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  일반 비밀번호: 메일 로그인 비밀번호 / 앱 비밀번호: 2단계 인증 계정 전용 비밀번호
                </p>
              </>
            ) : (
              <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3 text-xs text-zinc-600">
                <p>회사계정: 공용 메일함으로 팀과 공유됩니다.</p>
                <p className="mt-1">개인계정: 본인만 조회/동기화 가능합니다.</p>
                <p className="mt-1">OAuth 계정은 Gmail API 방식으로 동기화됩니다.</p>
              </div>
            )}
            <p className="mt-1 text-xs text-zinc-500">
              활성 + 동기화 사용 계정은 서버에서 10분마다 자동 동기화됩니다. 계정별 상태는 목록의 진행 상태 버튼으로 확인하세요.
            </p>
            <p className="mt-1 text-xs text-zinc-500">초기 동기화는 백그라운드로 진행되며 화면 이동해도 계속됩니다.</p>
            <p className="mt-1 text-xs text-zinc-500">최근 메일부터 순차 반영됩니다(권장 50건 단위).</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          {isGoogleOAuthMode ? (
            <button
              type="button"
              onClick={handleStartGoogleOAuth}
              disabled={oauthConnecting}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {oauthConnecting ? '연동 준비 중...' : 'Google로 연동'}
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {submitting ? '처리 중...' : editingAccountId ? '계정 수정' : '계정 등록'}
            </button>
          )}
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-end border-b border-zinc-200 bg-zinc-50 px-3 py-2">
          <select
            className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-700"
            value={accountScopeFilter}
            onChange={(e) => setAccountScopeFilter((e.target.value as '' | MailAccountScopeType) || '')}
          >
            <option value="">전체 계정</option>
            <option value="company">회사 공용</option>
            <option value="personal">개인</option>
          </select>
        </div>
        {loading ? (
          <div className="px-3 py-10 text-center text-sm text-zinc-500">조회 중...</div>
        ) : accounts.length === 0 ? (
          <div className="px-3 py-10 text-center text-sm text-zinc-500">등록된 메일 계정이 없습니다.</div>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {accounts.map((account) => {
              const progressTarget = account.initial_sync_target_count ?? 0
              const progressPercent =
                account.initial_sync_status === 'completed'
                  ? 100
                  : progressTarget > 0
                  ? Math.min(100, Math.max(0, Math.round((account.initial_sync_fetched_count / progressTarget) * 100)))
                  : 0
              const shouldRenderProgress = progressTarget > 0 || account.initial_sync_status === 'completed'
              const canCancelInitialSync = account.initial_sync_status === 'running'
              return (
              <li key={account.id} className="px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-zinc-900">{account.email}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {account.display_name || '-'} · {account.account_scope === 'personal' ? '개인' : '회사 공용'} · 고객사 #{account.company_id ?? '-'}
                    </p>
                  </div>
                  <p className="text-xs text-zinc-500">
                    주기 {account.sync_interval_minutes ?? 10}분 · 실패 {account.consecutive_failures ?? 0}회
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-zinc-600 md:grid-cols-3">
                  <div>
                    <p className="text-zinc-500">타입</p>
                    <p className="mt-0.5 text-zinc-700">
                      {(account.imap_host || '').toLowerCase().includes('pop3') ? 'POP3' : 'IMAP'} · {account.provider_type}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600">
                        {account.account_scope === 'personal' ? '개인' : '회사 공용'}
                      </span>
                      {account.auth_type === 'oauth' ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-700">OAuth 연동됨</span>
                      ) : (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600">비밀번호 인증</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-zinc-500">동기화</p>
                    <p className="mt-0.5 text-zinc-700">{formatKSTDateTime(account.last_synced_at)}</p>
                    <p className="mt-0.5 text-zinc-500">
                      초기: {getInitialSyncStatusLabel(account.initial_sync_status)}{' '}
                      {account.initial_sync_target_count
                        ? `(${account.initial_sync_fetched_count}/${account.initial_sync_target_count})`
                        : account.initial_sync_fetched_count > 0
                          ? `(${account.initial_sync_fetched_count})`
                          : ''}
                    </p>
                    {shouldRenderProgress ? (
                      <>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <p className="mt-0.5 text-zinc-500">진행률 {progressPercent}%</p>
                      </>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-zinc-500">오류/상태</p>
                    <p className="mt-0.5 text-zinc-700">{account.last_error_message || '-'}</p>
                    <p className="mt-0.5 text-zinc-500">다음: {formatKSTDateTime(account.next_sync_at)}</p>
                    <p className="mt-0.5 text-zinc-500">백오프: {formatKSTDateTime(account.backoff_until)}</p>
                    {account.initial_sync_started_at ? (
                      <p className="mt-0.5 text-zinc-500">가져오기 시작: {formatKSTDateTime(account.initial_sync_started_at)}</p>
                    ) : null}
                    {account.initial_sync_finished_at ? (
                      <p className="mt-0.5 text-zinc-500">가져오기 종료: {formatKSTDateTime(account.initial_sync_finished_at)}</p>
                    ) : null}
                    {account.initial_sync_error_message ? (
                      <p className="mt-0.5 text-rose-600">{account.initial_sync_error_message}</p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {account.auth_type === 'oauth' ? (
                    <p className="w-full text-xs text-zinc-500">OAuth 계정은 Gmail API 방식으로 동기화됩니다.</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleTestConnection(account.id)}
                    disabled={testingId === account.id}
                    className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                  >
                    {testingId === account.id ? '테스트 중' : '연결 테스트'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartInitialSync(account.id)}
                    disabled={initialSyncStartingId === account.id || account.initial_sync_status === 'running'}
                    className="rounded-md border border-blue-300 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                  >
                    {initialSyncStartingId === account.id ? '시작중' : '과거메일 가져오기'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRefreshInitialSyncStatus(account.id)}
                    disabled={initialSyncRefreshingId === account.id}
                    className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                  >
                    {initialSyncRefreshingId === account.id ? '조회중' : '진행 상태'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCancelInitialSync(account.id)}
                    disabled={initialSyncCancelingId === account.id || !canCancelInitialSync}
                    className={`rounded-md px-2.5 py-1 text-xs disabled:cursor-not-allowed ${
                      canCancelInitialSync
                        ? 'border border-rose-300 text-rose-700 hover:bg-rose-50'
                        : 'border border-zinc-200 bg-zinc-100 text-zinc-400'
                    }`}
                  >
                    {initialSyncCancelingId === account.id ? '중지중' : '가져오기 중지'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeactivate(account.id)}
                    disabled={deletingId === account.id}
                    className="rounded-md border border-rose-300 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                  >
                    {deletingId === account.id ? '삭제 중' : '삭제'}
                  </button>
                </div>
              </li>
            )})}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-zinc-900">폴더 관리</h3>
          <div className="mt-3 flex items-center gap-2">
            <input
              className={inputClass}
              value={folderNameInput}
              onChange={(e) => setFolderNameInput(e.target.value)}
              placeholder="폴더명"
            />
            <button
              type="button"
              onClick={handleCreateFolder}
              disabled={folderSubmitting}
              className="h-10 rounded-md bg-zinc-900 px-4 text-sm text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              등록
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {folders.map((folder) => (
              <div key={folder.id} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-sm">
                <span>{folder.name}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteFolder(folder.id)}
                  disabled={folderDeletingId === folder.id}
                  className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-zinc-900">자동분류 설정</h3>
          <p className="mt-1 text-xs text-zinc-500">조건에 맞는 메일을 자동으로 폴더 이동 또는 고객사 연결 처리합니다.</p>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <input className={inputClass} value={ruleNameInput} onChange={(e) => setRuleNameInput(e.target.value)} placeholder="자동분류 이름" />
            <select className={inputClass} value={ruleMailAccountId} onChange={(e) => setRuleMailAccountId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">적용 계정: 전체</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.email}</option>
              ))}
            </select>
            <select className={inputClass} value={ruleMatchField} onChange={(e) => setRuleMatchField(e.target.value as any)}>
              <option value="from_email">찾을 위치: 보낸 사람</option>
              <option value="subject">찾을 위치: 제목</option>
              <option value="snippet">찾을 위치: 본문</option>
              <option value="to_email">찾을 위치: 받는 사람</option>
              <option value="cc_email">찾을 위치: 참조자</option>
            </select>
            <select className={inputClass} value={ruleMatchOperator} onChange={(e) => setRuleMatchOperator(e.target.value as any)}>
              <option value="contains">찾는 방식: 포함</option>
              <option value="equals">찾는 방식: 일치</option>
              <option value="starts_with">찾는 방식: 시작</option>
              <option value="ends_with">찾는 방식: 끝</option>
            </select>
            <input className={inputClass} value={ruleMatchValue} onChange={(e) => setRuleMatchValue(e.target.value)} placeholder="찾을 내용 (예: @naver.com, 세금계산서)" />
            <input className={inputClass} value={rulePriority} onChange={(e) => setRulePriority(e.target.value)} placeholder="적용 순서 (기본 100, 숫자 작을수록 먼저)" />
            <select className={inputClass} value={ruleTargetFolderId} onChange={(e) => setRuleTargetFolderId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">이동할 폴더: 없음</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>{folder.name}</option>
              ))}
            </select>
            <input className={inputClass} value={ruleTargetCompanyId} onChange={(e) => setRuleTargetCompanyId(e.target.value)} placeholder="연결할 고객사 ID (선택)" />
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
            <input type="checkbox" checked={ruleStopProcessing} onChange={(e) => setRuleStopProcessing(e.target.checked)} />
            이 조건이 맞으면 다음 자동분류는 건너뜀
          </label>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleCreateRule}
              disabled={ruleSubmitting}
              className="h-10 rounded-md bg-zinc-900 px-4 text-sm text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              자동분류 추가
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-sm">
                <span>{rule.name} · {getRuleMatchFieldLabel(rule.match_field)} {getRuleMatchOperatorLabel(rule.match_operator)} "{rule.match_value}"</span>
                <button
                  type="button"
                  onClick={() => handleDeleteRule(rule.id)}
                  disabled={ruleDeletingId === rule.id}
                  className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-zinc-900">최근 동기화 로그</h3>
          <div className="mt-3 space-y-2">
            {syncLogs.length === 0 ? <p className="text-sm text-zinc-500">로그 없음</p> : null}
            {syncLogs.map((log) => (
              <p key={log.id} className="text-xs text-zinc-600">
                #{log.id} · {log.status} · {log.synced_count}건 · {formatKSTDateTimeAssumeUTC(log.started_at)}
              </p>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-zinc-900">최근 액션 로그</h3>
          <div className="mt-3 space-y-2">
            {actionLogs.length === 0 ? <p className="text-sm text-zinc-500">로그 없음</p> : null}
            {actionLogs.map((log) => (
              <p key={log.id} className="text-xs text-zinc-600">
                #{log.id} · {log.action} · {log.actor_type} · {formatKSTDateTimeAssumeUTC(log.created_at)}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
