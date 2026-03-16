'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { toast } from 'react-hot-toast'
import FileDropzone from '@/components/common/FileDropzone'
import RichTextEditor from '@/components/editor/RichTextEditor'
import { useAdminSessionContext } from '@/contexts/AdminSessionContext'
import { fetchCompanyTaxList } from '@/services/admin/company'
import { formatKSTDateTime } from '@/utils/dateTime'
import { htmlToPlainText } from '@/utils/htmlPlainText'
import { validateUploadFile } from '@/utils/fileUploadPolicy'
import { filterAdminVisibleMailAccounts } from '@/utils/mailAccountScope'
import {
  deleteMailDraft,
  getAdminMailErrorMessage,
  getMailDraftDetail,
  listMailAccounts,
  listMailDrafts,
  saveMailDraft,
  sendMail,
  uploadMailComposeAttachment,
} from '@/services/admin/mailService'
import type { MailAccount, MailDraft } from '@/types/adminMail'

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function splitEmailTokens(raw: string): string[] {
  return raw
    .split(/[,\n;\s]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

function mergeUniqueEmails(current: string[], incoming: string[]): string[] {
  const existing = new Set(current.map((email) => email.toLowerCase()))
  const next = [...current]
  for (const email of incoming) {
    const key = email.toLowerCase()
    if (existing.has(key)) continue
    existing.add(key)
    next.push(email)
  }
  return next
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(1)} GB`
}

export default function AdminMailComposePage() {
  const { session } = useAdminSessionContext()
  const [companies, setCompanies] = useState<Array<{ id: number; name: string; email: string | null }>>([])
  const [accounts, setAccounts] = useState<MailAccount[]>([])
  const [mailAccountId, setMailAccountId] = useState<number | ''>('')
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>('')
  const [toEmails, setToEmails] = useState<string[]>([])
  const [ccEmails, setCcEmails] = useState<string[]>([])
  const [toInput, setToInput] = useState('')
  const [ccInput, setCcInput] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([])
  const [isAddressBookOpen, setIsAddressBookOpen] = useState(false)
  const [addressBookKeyword, setAddressBookKeyword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [drafts, setDrafts] = useState<MailDraft[]>([])
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null)
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftSaving, setDraftSaving] = useState(false)
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [apiNotice, setApiNotice] = useState<string | null>(null)
  const attachmentInputRef = useRef<HTMLInputElement | null>(null)

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
    setToEmails([target.email])
    setToInput('')
  }

  const filteredCompanies = useMemo(() => {
    const keyword = addressBookKeyword.trim().toLowerCase()
    if (!keyword) return companies
    return companies.filter((company) => {
      const name = company.name.toLowerCase()
      const email = (company.email || '').toLowerCase()
      return name.includes(keyword) || email.includes(keyword)
    })
  }, [addressBookKeyword, companies])

  const appendAttachmentFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const invalidMessages: string[] = []
    setAttachmentFiles((prev) => {
      const next = [...prev]
      const existing = new Set(prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`))
      for (const file of Array.from(files)) {
        const validation = validateUploadFile(file)
        if (!validation.valid) {
          if (validation.message) invalidMessages.push(validation.message)
          continue
        }
        const key = `${file.name}-${file.size}-${file.lastModified}`
        if (existing.has(key)) continue
        existing.add(key)
        next.push(file)
      }
      return next
    })
    if (invalidMessages.length > 0) {
      const [firstMessage] = invalidMessages
      const suffix = invalidMessages.length > 1 ? ` 외 ${invalidMessages.length - 1}건` : ''
      toast.error(`${firstMessage}${suffix}`)
    }
  }

  const handleAttachmentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    appendAttachmentFiles(e.target.files)
    e.target.value = ''
  }

  const removeAttachmentFile = (index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, idx) => idx !== index))
  }

  const resolveRecipientEmails = (
    chips: string[],
    inputValue: string,
    setChips: (next: string[]) => void,
    setInputValue: (next: string) => void,
    fieldLabel: string
  ): string[] | null => {
    const tokens = splitEmailTokens(inputValue)
    if (tokens.length === 0) return chips
    const invalid = tokens.find((email) => !EMAIL_REGEX.test(email))
    if (invalid) {
      toast.error(`${fieldLabel} 이메일 형식이 올바르지 않습니다: ${invalid}`)
      return null
    }
    const merged = mergeUniqueEmails(chips, tokens)
    setChips(merged)
    setInputValue('')
    return merged
  }

  const handleRecipientInputKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    chips: string[],
    inputValue: string,
    setChips: (next: string[]) => void,
    setInputValue: (next: string) => void,
    fieldLabel: string
  ) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      resolveRecipientEmails(chips, inputValue, setChips, setInputValue, fieldLabel)
      return
    }
    if (e.key === 'Backspace' && inputValue.length === 0 && chips.length > 0) {
      e.preventDefault()
      setChips(chips.slice(0, -1))
    }
  }

  const handleFormKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter') return
    const target = e.target as HTMLElement | null
    if (!target) return
    if (target.getAttribute('data-email-chip-input') === 'true') return
    const tagName = target.tagName.toLowerCase()
    if (tagName === 'textarea' || tagName === 'button') return
    e.preventDefault()
  }

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    const resolvedToEmails = resolveRecipientEmails(toEmails, toInput, setToEmails, setToInput, '받는사람')
    if (!resolvedToEmails) return
    const resolvedCcEmails = resolveRecipientEmails(ccEmails, ccInput, setCcEmails, setCcInput, '참조')
    if (!resolvedCcEmails) return
    if (typeof mailAccountId !== 'number') {
      toast.error('발송 계정을 선택해 주세요.')
      return
    }
    if (resolvedToEmails.length === 0) {
      toast.error('수신자 이메일을 입력해 주세요.')
      return
    }
    if (!subject.trim()) {
      toast.error('제목을 입력해 주세요.')
      return
    }
    try {
      setSubmitting(true)
      const normalizedBodyHtml = bodyHtml.trim()
      const normalizedBodyText = htmlToPlainText(normalizedBodyHtml)
      const uploadedAttachmentS3Keys: string[] = []
      for (const file of attachmentFiles) {
        const validation = validateUploadFile(file)
        if (!validation.valid) {
          throw new Error(validation.message || `${file.name}: 업로드할 수 없는 파일입니다.`)
        }
        try {
          const uploaded = await uploadMailComposeAttachment(file)
          if (uploaded?.s3_key) uploadedAttachmentS3Keys.push(uploaded.s3_key)
        } catch (error) {
          const detailMessage = getAdminMailErrorMessage(error)
          throw new Error(`${file.name}: ${detailMessage}`)
        }
      }

      const res = await sendMail({
        mail_account_id: mailAccountId,
        company_id: typeof selectedCompanyId === 'number' ? selectedCompanyId : undefined,
        to_emails: resolvedToEmails,
        cc_emails: resolvedCcEmails,
        subject: subject.trim(),
        body_text: normalizedBodyText || undefined,
        body_html: normalizedBodyHtml || undefined,
        attachment_s3_keys: uploadedAttachmentS3Keys.length > 0 ? uploadedAttachmentS3Keys : undefined,
        attachment_mode: 'attachment',
        queue_on_fail: true,
      })
      if (res.status === 'queued') {
        toast.success(`발송 실패로 큐에 등록됨 (작업 #${res.queue_job_id ?? '-'})`)
      } else if (res.status === 'failed') {
        toast.error('메일 발송 실패')
      } else {
        toast.success(`메일 발송 완료 (#${res.mail_message_id ?? '-'})`)
      }
      setToEmails([])
      setCcEmails([])
      setToInput('')
      setCcInput('')
      setSelectedCompanyId('')
      setSubject('')
      setBodyHtml('')
      setAttachmentFiles([])
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
      if (error instanceof Error && error.message) {
        toast.error(error.message)
      } else {
        toast.error(getAdminMailErrorMessage(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveDraft = async () => {
    const resolvedToEmails = resolveRecipientEmails(toEmails, toInput, setToEmails, setToInput, '받는사람')
    if (!resolvedToEmails) return
    const resolvedCcEmails = resolveRecipientEmails(ccEmails, ccInput, setCcEmails, setCcInput, '참조')
    if (!resolvedCcEmails) return
    try {
      setDraftSaving(true)
      const normalizedBodyHtml = bodyHtml.trim()
      const normalizedBodyText = htmlToPlainText(normalizedBodyHtml)
      const res = await saveMailDraft({
        draft_id: selectedDraftId ?? undefined,
        mail_account_id: typeof mailAccountId === 'number' ? mailAccountId : undefined,
        company_id: typeof selectedCompanyId === 'number' ? selectedCompanyId : undefined,
        to_emails: resolvedToEmails,
        cc_emails: resolvedCcEmails,
        subject: subject.trim() || undefined,
        body_text: normalizedBodyText || undefined,
        body_html: normalizedBodyHtml || undefined,
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
      setToEmails(draft.to_emails || [])
      setCcEmails(draft.cc_emails || [])
      setToInput('')
      setCcInput('')
      setSubject(draft.subject || '')
      setBodyHtml(draft.body_html || draft.body_text || '')
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <form
        onSubmit={handleSend}
        onKeyDown={handleFormKeyDown}
        className="flex min-h-[680px] flex-col rounded-xl border border-zinc-200 bg-white"
      >
        <div className="flex flex-col gap-2 border-b border-zinc-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">메일 작성</h2>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-60"
            >
              {submitting ? '발송 중...' : '메일 발송'}
            </button>
            <button
              type="button"
              disabled={draftSaving}
              onClick={handleSaveDraft}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              {draftSaving ? '저장 중...' : '임시저장'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-zinc-600">보내는계정</p>
            <select
              className="h-9 min-w-[260px] rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
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
          </div>
        </div>

        <div className="divide-y divide-zinc-200 border-b border-zinc-200">
          <div className="grid grid-cols-1 items-center gap-2 px-4 py-2.5 md:grid-cols-[88px_minmax(0,1fr)] md:gap-3">
            <p className="text-xs font-medium text-zinc-600">받는사람</p>
            <div className="flex items-center gap-2">
              <div className="flex min-h-10 w-full flex-wrap items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 focus-within:border-zinc-500 focus-within:ring-2 focus-within:ring-zinc-200">
                {toEmails.map((email) => (
                  <span key={email} className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-800">
                    {email}
                    <button
                      type="button"
                      onClick={() => setToEmails((prev) => prev.filter((item) => item !== email))}
                      className="text-zinc-500 hover:text-zinc-700"
                    >
                      x
                    </button>
                  </span>
                ))}
                <input
                  data-email-chip-input="true"
                  className="h-7 min-w-[180px] flex-1 border-none bg-transparent px-1 text-sm text-zinc-900 outline-none"
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  onBlur={() => {
                    void resolveRecipientEmails(toEmails, toInput, setToEmails, setToInput, '받는사람')
                  }}
                  onKeyDown={(e) =>
                    handleRecipientInputKeyDown(e, toEmails, toInput, setToEmails, setToInput, '받는사람')
                  }
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text')
                    if (!pasted) return
                    e.preventDefault()
                    void resolveRecipientEmails(toEmails, `${toInput} ${pasted}`, setToEmails, setToInput, '받는사람')
                  }}
                  placeholder="이메일 입력 후 Enter / 쉼표 / 포커스 이동으로 확정"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsAddressBookOpen(true)}
                className="h-10 shrink-0 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                주소록
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 items-center gap-2 px-4 py-2.5 md:grid-cols-[88px_minmax(0,1fr)] md:gap-3">
            <p className="text-xs font-medium text-zinc-600">참조</p>
            <div className="flex min-h-10 w-full flex-wrap items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 focus-within:border-zinc-500 focus-within:ring-2 focus-within:ring-zinc-200">
              {ccEmails.map((email) => (
                <span key={email} className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-800">
                  {email}
                  <button
                    type="button"
                    onClick={() => setCcEmails((prev) => prev.filter((item) => item !== email))}
                    className="text-zinc-500 hover:text-zinc-700"
                  >
                    x
                  </button>
                </span>
              ))}
              <input
                data-email-chip-input="true"
                className="h-7 min-w-[180px] flex-1 border-none bg-transparent px-1 text-sm text-zinc-900 outline-none"
                value={ccInput}
                onChange={(e) => setCcInput(e.target.value)}
                onBlur={() => {
                  void resolveRecipientEmails(ccEmails, ccInput, setCcEmails, setCcInput, '참조')
                }}
                onKeyDown={(e) => handleRecipientInputKeyDown(e, ccEmails, ccInput, setCcEmails, setCcInput, '참조')}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text')
                  if (!pasted) return
                  e.preventDefault()
                  void resolveRecipientEmails(ccEmails, `${ccInput} ${pasted}`, setCcEmails, setCcInput, '참조')
                }}
                placeholder="참조 메일 입력 (선택)"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 items-center gap-2 px-4 py-2.5 md:grid-cols-[88px_minmax(0,1fr)] md:gap-3">
            <p className="text-xs font-medium text-zinc-600">제목</p>
            <input
              className={inputClass}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="메일 제목"
            />
          </div>

          <div className="grid grid-cols-1 items-start gap-2 px-4 py-2.5 md:grid-cols-[88px_minmax(0,1fr)] md:gap-3">
            <p className="pt-2 text-xs font-medium text-zinc-600">파일첨부</p>
            <div className="space-y-2">
              <input
                ref={attachmentInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleAttachmentFileChange}
              />
              <div className="flex flex-wrap items-stretch gap-2">
                <FileDropzone
                  onFilesDrop={appendAttachmentFiles}
                  className="flex min-h-9 min-w-[240px] flex-1 items-center rounded-md border border-dashed px-3 text-xs transition"
                  idleClassName="border-zinc-300 bg-white text-zinc-500"
                  activeClassName="border-zinc-500 bg-zinc-50 text-zinc-800"
                >
                  파일 드래그
                </FileDropzone>
                <button
                  type="button"
                  onClick={() => attachmentInputRef.current?.click()}
                  className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  파일첨부
                </button>
                <button
                  type="button"
                  className="h-9 rounded-md border border-zinc-200 bg-zinc-100 px-3 text-sm text-zinc-500"
                  onClick={() => toast('내 파일함 연동은 다음 패치에서 연결됩니다.')}
                >
                  내파일함
                </button>
                {attachmentFiles.length > 0 ? (
                  <span className="flex h-9 items-center text-xs text-zinc-600">{attachmentFiles.length}개 선택됨</span>
                ) : null}
              </div>
              {attachmentFiles.length > 0 ? (
                <ul className="space-y-1">
                  {attachmentFiles.map((file, index) => (
                    <li
                      key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                      className="flex items-center justify-between rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-800">{file.name}</p>
                        <p className="text-zinc-500">{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachmentFile(index)}
                        className="ml-2 rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50"
                      >
                        제거
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 py-3">
          <div className="min-h-[360px] overflow-hidden rounded-md bg-white">
            <RichTextEditor value={bodyHtml} onChange={setBodyHtml} preset="mail" />
          </div>
        </div>

        <div className="border-t border-zinc-200 bg-zinc-50/70 px-4 py-3">
          <div className="mt-3 flex items-center">
            <p className="text-xs text-zinc-500">임시보관 메일은 3일 후 자동 삭제됩니다.</p>
          </div>
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

      {isAddressBookOpen ? (
        <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setIsAddressBookOpen(false)}>
          <aside
            className="absolute right-0 top-0 h-full w-full max-w-md border-l border-zinc-200 bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900">주소록</h3>
              <button
                type="button"
                onClick={() => setIsAddressBookOpen(false)}
                className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                닫기
              </button>
            </div>
            <input
              className={inputClass}
              value={addressBookKeyword}
              onChange={(e) => setAddressBookKeyword(e.target.value)}
              placeholder="회사명/이메일 검색"
            />
            <div className="mt-3 max-h-[calc(100vh-140px)] space-y-2 overflow-auto pr-1">
              {filteredCompanies.length === 0 ? (
                <p className="rounded border border-zinc-200 px-3 py-4 text-center text-xs text-zinc-500">검색 결과가 없습니다.</p>
              ) : (
                filteredCompanies.map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => {
                      handleSelectCompany(String(company.id))
                      setIsAddressBookOpen(false)
                    }}
                    className={`w-full rounded border px-3 py-2 text-left text-xs transition ${
                      selectedCompanyId === company.id ? 'border-zinc-700 bg-zinc-50' : 'border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <p className="font-medium text-zinc-900">{company.name}</p>
                    <p className="mt-1 text-zinc-600">{company.email || '이메일 미등록'}</p>
                  </button>
                ))
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  )
}
