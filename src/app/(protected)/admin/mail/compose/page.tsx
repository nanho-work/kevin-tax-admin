'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'react-hot-toast'
import { useAdminSessionContext } from '@/contexts/AdminSessionContext'
import { fetchCompanyTaxList } from '@/services/admin/company'
import { formatKSTDateTime } from '@/utils/dateTime'
import { filterAdminVisibleMailAccounts } from '@/utils/mailAccountScope'
import {
  deleteMailDraft,
  getAdminMailErrorMessage,
  getMailDraftDetail,
  listMailAccounts,
  listMailDrafts,
  saveMailDraft,
  sendMail,
} from '@/services/admin/mailService'
import type { MailAccount, MailDraft } from '@/types/adminMail'

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

function parseEmails(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

export default function AdminMailComposePage() {
  const { session } = useAdminSessionContext()
  const [companies, setCompanies] = useState<Array<{ id: number; name: string; email: string | null }>>([])
  const [accounts, setAccounts] = useState<MailAccount[]>([])
  const [mailAccountId, setMailAccountId] = useState<number | ''>('')
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>('')
  const [toRaw, setToRaw] = useState('')
  const [ccRaw, setCcRaw] = useState('')
  const [bccRaw, setBccRaw] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [attachmentMode, setAttachmentMode] = useState<'attachment' | 'secure_link'>('attachment')
  const [secureLinkExpireDays, setSecureLinkExpireDays] = useState(7)
  const [secureLinkMaxDownloadCount, setSecureLinkMaxDownloadCount] = useState(5)
  const [queueOnFail, setQueueOnFail] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [drafts, setDrafts] = useState<MailDraft[]>([])
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null)
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftSaving, setDraftSaving] = useState(false)
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [apiNotice, setApiNotice] = useState<string | null>(null)

  const loadAccounts = async () => {
    try {
      setLoadingAccounts(true)
      const res = await listMailAccounts(true)
      const visibleAccounts = filterAdminVisibleMailAccounts(res.items || [], session?.id)
      setAccounts(visibleAccounts)
      if (visibleAccounts.length === 0) {
        setMailAccountId('')
      } else {
        setMailAccountId((prev) => {
          if (typeof prev === 'number' && visibleAccounts.some((item) => item.id === prev)) return prev
          return visibleAccounts[0].id
        })
      }
      setApiNotice(null)
    } catch (error) {
      const message = getAdminMailErrorMessage(error)
      setApiNotice(message)
      setAccounts([])
    } finally {
      setLoadingAccounts(false)
    }
  }

  const loadCompanies = async () => {
    try {
      const res = await fetchCompanyTaxList({
        page: 1,
        limit: 200,
      })
      const normalized = (res.items || []).map((item: any) => ({
        id: Number(item.id),
        name: String(item.company_name || `회사#${item.id}`),
        email: item.manager_email || item.admin_email || item.email || null,
      }))
      setCompanies(normalized)
    } catch {
      setCompanies([])
    }
  }

  useEffect(() => {
    loadAccounts()
    loadCompanies()
    void loadDrafts()
  }, [])

  useEffect(() => {
    if (!session?.id) return
    void loadAccounts()
  }, [session?.id])

  const loadDrafts = async () => {
    try {
      const res = await listMailDrafts(1, 20)
      setDrafts(res.items || [])
    } catch {
      setDrafts([])
    }
  }

  const handleSelectCompany = (value: string) => {
    const companyId = value ? Number(value) : ''
    setSelectedCompanyId(companyId)
    if (typeof companyId !== 'number') return
    const target = companies.find((item) => item.id === companyId)
    if (!target?.email) return
    setToRaw(target.email)
  }

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    const toEmails = parseEmails(toRaw)
    if (typeof mailAccountId !== 'number') {
      toast.error('발송 계정을 선택해 주세요.')
      return
    }
    if (toEmails.length === 0) {
      toast.error('수신자 이메일을 입력해 주세요.')
      return
    }
    if (!subject.trim()) {
      toast.error('제목을 입력해 주세요.')
      return
    }

    try {
      setSubmitting(true)
      const res = await sendMail({
        mail_account_id: mailAccountId,
        company_id: typeof selectedCompanyId === 'number' ? selectedCompanyId : undefined,
        to_emails: toEmails,
        cc_emails: parseEmails(ccRaw),
        bcc_emails: parseEmails(bccRaw),
        subject: subject.trim(),
        body_text: bodyText.trim() || undefined,
        attachment_mode: attachmentMode,
        secure_link_expire_days: attachmentMode === 'secure_link' ? secureLinkExpireDays : undefined,
        secure_link_max_download_count: attachmentMode === 'secure_link' ? secureLinkMaxDownloadCount : undefined,
        queue_on_fail: queueOnFail,
      })
      if (res.status === 'queued') {
        toast.success(`발송 실패로 큐에 등록됨 (작업 #${res.queue_job_id ?? '-'})`)
      } else if (res.status === 'failed') {
        toast.error('메일 발송 실패')
      } else {
        toast.success(`메일 발송 완료 (#${res.mail_message_id ?? '-'})`)
      }
      setToRaw('')
      setCcRaw('')
      setBccRaw('')
      setSelectedCompanyId('')
      setSubject('')
      setBodyText('')
      setAttachmentMode('attachment')
      setSecureLinkExpireDays(7)
      setSecureLinkMaxDownloadCount(5)
      if (selectedDraftId) {
        try {
          await deleteMailDraft(selectedDraftId)
        } catch {
          // ignore
        }
        setSelectedDraftId(null)
        await loadDrafts()
      }
    } catch (error) {
      toast.error(getAdminMailErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveDraft = async () => {
    try {
      setDraftSaving(true)
      const res = await saveMailDraft({
        draft_id: selectedDraftId ?? undefined,
        mail_account_id: typeof mailAccountId === 'number' ? mailAccountId : undefined,
        company_id: typeof selectedCompanyId === 'number' ? selectedCompanyId : undefined,
        to_emails: parseEmails(toRaw),
        cc_emails: parseEmails(ccRaw),
        bcc_emails: parseEmails(bccRaw),
        subject: subject.trim() || undefined,
        body_text: bodyText.trim() || undefined,
      })
      setSelectedDraftId(res.id)
      toast.success('임시보관 저장 완료')
      await loadDrafts()
    } catch (error) {
      toast.error(getAdminMailErrorMessage(error))
    } finally {
      setDraftSaving(false)
    }
  }

  const handleLoadDraft = async (draftId: number) => {
    try {
      setDraftLoading(true)
      const draft = await getMailDraftDetail(draftId)
      setSelectedDraftId(draft.id)
      setMailAccountId(draft.mail_account_id ?? '')
      setSelectedCompanyId(draft.company_id ?? '')
      setToRaw((draft.to_emails || []).join(', '))
      setCcRaw((draft.cc_emails || []).join(', '))
      setBccRaw((draft.bcc_emails || []).join(', '))
      setSubject(draft.subject || '')
      setBodyText(draft.body_text || '')
      toast.success('임시보관 메일을 불러왔습니다.')
    } catch (error) {
      toast.error(getAdminMailErrorMessage(error))
    } finally {
      setDraftLoading(false)
    }
  }

  const handleDeleteDraft = async (draftId: number) => {
    try {
      await deleteMailDraft(draftId)
      if (selectedDraftId === draftId) {
        setSelectedDraftId(null)
      }
      toast.success('임시보관 삭제 완료')
      await loadDrafts()
    } catch (error) {
      toast.error(getAdminMailErrorMessage(error))
    }
  }

  return (
    <section className="space-y-4">
      {apiNotice ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {apiNotice}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <form onSubmit={handleSend} className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">메일 작성</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <select
            className={inputClass}
            value={selectedCompanyId}
            onChange={(e) => handleSelectCompany(e.target.value)}
          >
            <option value="">고객사 선택 (자동 채움, 선택)</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
                {company.email ? ` · ${company.email}` : ' · 메일없음'}
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            value={mailAccountId}
            onChange={(e) => setMailAccountId(e.target.value ? Number(e.target.value) : '')}
            disabled={loadingAccounts}
          >
            {accounts.length === 0 ? <option value="">발송 계정 없음</option> : null}
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.email}
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            value={toRaw}
            onChange={(e) => setToRaw(e.target.value)}
            placeholder="받는사람 (콤마로 구분)"
          />
          <input
            className={inputClass}
            value={ccRaw}
            onChange={(e) => setCcRaw(e.target.value)}
            placeholder="참조 (선택, 콤마 구분)"
          />
          <input
            className={inputClass}
            value={bccRaw}
            onChange={(e) => setBccRaw(e.target.value)}
            placeholder="숨은참조 (선택, 콤마 구분)"
          />
          <input
            className={inputClass}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="제목"
          />
        </div>

        <div className="mt-3">
          <textarea
            rows={14}
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            placeholder="메일 본문"
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <select
            className={inputClass}
            value={attachmentMode}
            onChange={(e) => setAttachmentMode(e.target.value as 'attachment' | 'secure_link')}
          >
            <option value="attachment">첨부파일 직접 첨부</option>
            <option value="secure_link">보안링크 첨부</option>
          </select>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={secureLinkExpireDays}
            onChange={(e) => setSecureLinkExpireDays(Math.max(1, Number(e.target.value) || 1))}
            disabled={attachmentMode !== 'secure_link'}
            placeholder="보안링크 만료일(일)"
          />
          <input
            type="number"
            min={1}
            className={inputClass}
            value={secureLinkMaxDownloadCount}
            onChange={(e) => setSecureLinkMaxDownloadCount(Math.max(1, Number(e.target.value) || 1))}
            disabled={attachmentMode !== 'secure_link'}
            placeholder="최대 다운로드 횟수"
          />
        </div>

        <label className="mt-3 flex items-center gap-2 text-xs text-zinc-600">
          <input type="checkbox" checked={queueOnFail} onChange={(e) => setQueueOnFail(e.target.checked)} />
          발송 실패 시 자동 큐 등록
        </label>
        <p className="mt-1 text-xs text-zinc-500">임시보관 메일은 3일 후 자동 삭제됩니다.</p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={draftSaving}
            onClick={handleSaveDraft}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
          >
            {draftSaving ? '저장 중...' : '임시저장'}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {submitting ? '발송 중...' : '메일 발송'}
          </button>
        </div>
      </form>
      <aside className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">임시보관함</h3>
          <button
            type="button"
            onClick={() => void loadDrafts()}
            className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
          >
            새로고침
          </button>
        </div>
        <p className="mb-2 text-xs text-zinc-500">완전삭제한 메일은 복구할 수 없습니다.</p>
        <div className="space-y-2">
          {drafts.length === 0 ? (
            <p className="text-xs text-zinc-500">임시보관 메일이 없습니다.</p>
          ) : (
            drafts.map((draft) => (
              <div
                key={draft.id}
                className={`rounded-md border px-2 py-2 text-xs ${selectedDraftId === draft.id ? 'border-zinc-700 bg-zinc-50' : 'border-zinc-200'}`}
              >
                <p className="truncate font-medium text-zinc-900">{draft.subject || '(제목 없음)'}</p>
                <p className="mt-1 truncate text-zinc-500">{(draft.to_emails || []).join(', ') || '-'}</p>
                <p className="mt-1 text-[11px] text-zinc-500">만료: {formatKSTDateTime(draft.expires_at)}</p>
                <div className="mt-2 flex items-center gap-1">
                  <button
                    type="button"
                    disabled={draftLoading}
                    onClick={() => void handleLoadDraft(draft.id)}
                    className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    불러오기
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteDraft(draft.id)}
                    className="rounded border border-rose-300 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
      </div>
    </section>
  )
}
