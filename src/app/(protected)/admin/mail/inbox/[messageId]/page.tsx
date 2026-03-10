'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { formatKSTDateTimeKorean } from '@/utils/dateTime'
import { isInlineMailAttachment, sanitizeMailBodyHtml } from '@/utils/mailBodyHtml'
import {
  getMailForwardDraft,
  getAdminMailErrorMessage,
  importMailAttachments,
  listMailAttachments,
  getMailMessageDetail,
  getMailReplyDraft,
  moveMailMessageToTrash,
  purgeMailMessage,
  restoreMailMessageFromTrash,
  sendMailForward,
  sendMailReply,
  updateMailMessageRead,
} from '@/services/admin/mailService'
import type { MailForwardDraftResponse, MailMessageDetail, MailReplyDraftResponse } from '@/types/adminMail'

function parseEmails(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

export default function AdminMailMessageDetailPage() {
  const router = useRouter()
  const params = useParams<{ messageId: string }>()
  const searchParams = useSearchParams()
  const messageId = Number(params.messageId)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<MailMessageDetail | null>(null)
  const [readUpdating, setReadUpdating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showRecipients, setShowRecipients] = useState(false)
  const autoReadDoneRef = useRef<number | null>(null)
  const [composeMode, setComposeMode] = useState<null | 'reply' | 'forward'>(null)
  const [draftLoading, setDraftLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [replyDraft, setReplyDraft] = useState<MailReplyDraftResponse | null>(null)
  const [forwardDraft, setForwardDraft] = useState<MailForwardDraftResponse | null>(null)
  const [toRaw, setToRaw] = useState('')
  const [ccRaw, setCcRaw] = useState('')
  const [bccRaw, setBccRaw] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [includeOriginalBody, setIncludeOriginalBody] = useState(true)
  const [includeOriginalAttachments, setIncludeOriginalAttachments] = useState(true)
  const [attachmentMode, setAttachmentMode] = useState<'attachment' | 'secure_link'>('attachment')
  const [secureLinkExpireDays, setSecureLinkExpireDays] = useState(7)
  const [secureLinkMaxDownloadCount, setSecureLinkMaxDownloadCount] = useState(5)
  const [includeInlineAttachments, setIncludeInlineAttachments] = useState(false)
  const [attachmentActionLoadingId, setAttachmentActionLoadingId] = useState<number | null>(null)

  const backHref = useMemo(() => {
    const query = searchParams.toString()
    return query ? `/admin/mail/inbox?${query}` : '/admin/mail/inbox'
  }, [searchParams])
  const backLabel = useMemo(() => {
    const mailbox = searchParams.get('mailbox')
    if (mailbox === 'inbox') return '< 받은메일함'
    if (mailbox === 'sent') return '< 보낸메일함'
    if (mailbox === 'trash') return '< 휴지통'
    return '< 전체메일'
  }, [searchParams])
  const scopedMailAccountId = useMemo(() => {
    const accountId = Number(searchParams.get('account_id'))
    return Number.isFinite(accountId) && accountId > 0 ? accountId : undefined
  }, [searchParams])

  const mergeDetailAttachments = (
    detailRes: MailMessageDetail,
    attachmentItems: MailMessageDetail['attachments']
  ): MailMessageDetail => {
    const detailById = new Map((detailRes.attachments || []).map((attachment) => [attachment.id, attachment]))
    const merged = (attachmentItems || []).map((attachment) => ({
      ...(detailById.get(attachment.id) || {}),
      ...attachment,
    }))
    return { ...detailRes, attachments: merged }
  }

  const loadDetail = async () => {
    if (!Number.isFinite(messageId) || messageId <= 0) return
    try {
      setLoading(true)
      const [detailRes, attachmentRes] = await Promise.all([
        getMailMessageDetail(messageId, scopedMailAccountId),
        listMailAttachments(messageId, includeInlineAttachments, scopedMailAccountId).catch(() => ({ items: [] })),
      ])
      setDetail(mergeDetailAttachments(detailRes, attachmentRes.items || []))
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(getAdminMailErrorMessage(error))
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDetail()
  }, [messageId, scopedMailAccountId, includeInlineAttachments])

  useEffect(() => {
    if (!detail || detail.is_read) return
    if (autoReadDoneRef.current === detail.id) return
    autoReadDoneRef.current = detail.id
    void updateMailMessageRead(detail.id, true, scopedMailAccountId)
      .then(() => {
        setDetail((prev) => (prev ? { ...prev, is_read: true } : prev))
      })
      .catch(() => {
        autoReadDoneRef.current = null
      })
  }, [detail])

  const openReplyComposer = async () => {
    if (!detail) return
    try {
      setDraftLoading(true)
      const draft = await getMailReplyDraft(detail.id, 'reply')
      setComposeMode('reply')
      setReplyDraft(draft)
      setForwardDraft(null)
      setToRaw('')
      setCcRaw('')
      setBccRaw('')
      setSubject(draft.subject || '')
      setBodyText('')
      setAttachmentMode('attachment')
      setSecureLinkExpireDays(7)
      setSecureLinkMaxDownloadCount(5)
    } catch (error) {
      toast.error(getAdminMailErrorMessage(error))
    } finally {
      setDraftLoading(false)
    }
  }

  const openForwardComposer = async () => {
    if (!detail) return
    try {
      setDraftLoading(true)
      const draft = await getMailForwardDraft(detail.id)
      setComposeMode('forward')
      setForwardDraft(draft)
      setReplyDraft(null)
      setToRaw((draft.to_emails || []).join(', '))
      setCcRaw((draft.cc_emails || []).join(', '))
      setBccRaw((draft.bcc_emails || []).join(', '))
      setSubject(draft.subject || '')
      setBodyText('')
      setIncludeOriginalBody(true)
      setIncludeOriginalAttachments(true)
      setAttachmentMode('attachment')
      setSecureLinkExpireDays(7)
      setSecureLinkMaxDownloadCount(5)
    } catch (error) {
      toast.error(getAdminMailErrorMessage(error))
    } finally {
      setDraftLoading(false)
    }
  }

  const handleSendComposer = async () => {
    if (!detail) return
    if (!subject.trim()) {
      toast.error('제목을 입력해 주세요.')
      return
    }
    if (parseEmails(toRaw).length === 0 && composeMode === 'forward') {
      toast.error('전달 받는사람을 입력해 주세요.')
      return
    }
    try {
      setSending(true)
      if (composeMode === 'reply') {
        await sendMailReply(detail.id, {
          mode: 'reply',
          subject: subject.trim(),
          body_text: bodyText.trim() || undefined,
          additional_to_emails: parseEmails(toRaw),
          additional_cc_emails: parseEmails(ccRaw),
          additional_bcc_emails: parseEmails(bccRaw),
          attachment_mode: attachmentMode,
          secure_link_expire_days: attachmentMode === 'secure_link' ? secureLinkExpireDays : undefined,
          secure_link_max_download_count: attachmentMode === 'secure_link' ? secureLinkMaxDownloadCount : undefined,
          queue_on_fail: true,
        })
      }
      if (composeMode === 'forward') {
        const forwardAttachmentKeys =
          forwardDraft?.attachment_s3_keys ||
          forwardDraft?.available_attachment_s3_keys ||
          []
        await sendMailForward(detail.id, {
          subject: subject.trim(),
          body_text: bodyText.trim() || undefined,
          to_emails: parseEmails(toRaw),
          cc_emails: parseEmails(ccRaw),
          bcc_emails: parseEmails(bccRaw),
          include_original_body: includeOriginalBody,
          include_original_attachments: includeOriginalAttachments,
          attachment_s3_keys: forwardAttachmentKeys,
          attachment_mode: attachmentMode,
          secure_link_expire_days: attachmentMode === 'secure_link' ? secureLinkExpireDays : undefined,
          secure_link_max_download_count: attachmentMode === 'secure_link' ? secureLinkMaxDownloadCount : undefined,
          queue_on_fail: true,
        })
      }
      toast.success(composeMode === 'reply' ? '답장 전송 완료' : '전달 전송 완료')
      setComposeMode(null)
      setReplyDraft(null)
      setForwardDraft(null)
      setToRaw('')
      setCcRaw('')
      setBccRaw('')
      setSubject('')
      setBodyText('')
      setAttachmentMode('attachment')
      setSecureLinkExpireDays(7)
      setSecureLinkMaxDownloadCount(5)
    } catch (error) {
      toast.error(getAdminMailErrorMessage(error))
    } finally {
      setSending(false)
    }
  }

  const handleToggleRead = async () => {
    if (!detail) return
    try {
      setReadUpdating(true)
      await updateMailMessageRead(detail.id, !detail.is_read, scopedMailAccountId)
      await loadDetail()
      toast.success(detail.is_read ? '안읽음 처리되었습니다.' : '읽음 처리되었습니다.')
    } catch (error) {
      toast.error(getAdminMailErrorMessage(error))
    } finally {
      setReadUpdating(false)
    }
  }

  const handleMoveTrash = async () => {
    if (!detail) return
    try {
      await moveMailMessageToTrash(detail.id, scopedMailAccountId)
      toast.success('휴지통으로 이동했습니다.')
      router.replace(backHref)
    } catch (error) {
      toast.error(getAdminMailErrorMessage(error))
    }
  }

  const handleRestore = async () => {
    if (!detail) return
    try {
      await restoreMailMessageFromTrash(detail.id, scopedMailAccountId)
      toast.success('복구되었습니다.')
      router.replace(backHref)
    } catch (error) {
      toast.error(getAdminMailErrorMessage(error))
    }
  }

  const handlePurge = async () => {
    if (!detail) return
    if (!window.confirm('완전삭제 후 복구할 수 없습니다. 삭제할까요?')) return
    try {
      await purgeMailMessage(detail.id, scopedMailAccountId)
      toast.success('완전삭제되었습니다.')
      router.replace(backHref)
    } catch (error) {
      toast.error(getAdminMailErrorMessage(error))
    }
  }

  const refreshAttachmentById = async (attachmentId: number) => {
    if (!detail) return null
    const [detailRes, attachmentRes] = await Promise.all([
      getMailMessageDetail(detail.id, scopedMailAccountId),
      listMailAttachments(detail.id, includeInlineAttachments, scopedMailAccountId),
    ])
    const merged = mergeDetailAttachments(detailRes, attachmentRes.items || [])
    setDetail(merged)
    return merged.attachments.find((item) => item.id === attachmentId) || null
  }

  const handleImportAttachment = async (attachmentId: number) => {
    if (!detail) return
    try {
      setAttachmentActionLoadingId(attachmentId)
      await importMailAttachments(detail.id, { attachment_ids: [attachmentId] })
      await refreshAttachmentById(attachmentId)
      toast.success('첨부파일을 가져왔습니다.')
    } catch (error) {
      toast.error(getAdminMailErrorMessage(error))
    } finally {
      setAttachmentActionLoadingId(null)
    }
  }

  const handleOpenAttachment = async (
    attachmentId: number,
    mode: 'preview' | 'download'
  ) => {
    const current = detail?.attachments.find((item) => item.id === attachmentId)
    if (!current) return
    if (current.scan_status === 'infected' || current.scan_status === 'error') {
      toast.error('보안 검사 결과로 열 수 없는 첨부파일입니다.')
      return
    }

    try {
      setAttachmentActionLoadingId(attachmentId)
      const refreshed = await refreshAttachmentById(attachmentId)
      if (!refreshed) {
        toast.error('첨부파일 정보를 다시 불러오지 못했습니다.')
        return
      }

      if (refreshed.download_status !== 'downloaded') {
        toast.error('먼저 첨부파일을 가져와 주세요.')
        return
      }

      const previewUrl = refreshed.preview_url || refreshed.file_url || refreshed.url || null
      const downloadUrl = refreshed.download_url || refreshed.preview_url || refreshed.file_url || refreshed.url || null
      const targetUrl = mode === 'preview' ? previewUrl : downloadUrl
      if (!targetUrl) {
        toast.error('첨부파일 링크를 가져오지 못했습니다. 다시 시도해 주세요.')
        return
      }
      window.open(targetUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(getAdminMailErrorMessage(error))
    } finally {
      setAttachmentActionLoadingId(null)
    }
  }

  const renderedMail = useMemo(() => {
    const attachments = detail?.attachments || []
    const htmlSource = detail?.body_html_rendered || detail?.body_html || ''
    return {
      sanitizedHtml: sanitizeMailBodyHtml(htmlSource, attachments),
      visibleAttachments: includeInlineAttachments
        ? attachments
        : attachments.filter((attachment) => !isInlineMailAttachment(attachment)),
    }
  }, [detail?.body_html, detail?.body_html_rendered, detail?.attachments, includeInlineAttachments])

  return (
    <section className="w-full">
      <div className="flex items-center gap-2 rounded-t-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
        >
          {backLabel}
        </button>
        {detail ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleRead}
              disabled={readUpdating}
              className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              {detail.is_read ? '안읽음' : '읽음'}
            </button>
            <button
              type="button"
              onClick={() => void openReplyComposer()}
              disabled={draftLoading}
              className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              답장
            </button>
            <button
              type="button"
              onClick={() => void openForwardComposer()}
              disabled={draftLoading}
              className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              전달
            </button>
            {detail.is_deleted ? (
              <>
                <button
                  type="button"
                  onClick={handleRestore}
                  className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                >
                  복구
                </button>
                <button
                  type="button"
                  onClick={handlePurge}
                  className="rounded border border-rose-300 bg-white px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50"
                >
                  완전삭제
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleMoveTrash}
                className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                삭제
              </button>
            )}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-b-xl border-x border-b border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500">조회 중...</div>
      ) : errorMessage ? (
        <div className="rounded-b-xl border-x border-b border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">{errorMessage}</div>
      ) : !detail ? (
        <div className="rounded-b-xl border-x border-b border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500">메일을 찾을 수 없습니다.</div>
      ) : (
        <div>
          <div className="rounded-b-xl border-x border-b border-zinc-200 bg-white p-4">
            <p className="text-lg font-semibold text-zinc-900">{detail.subject || '(제목 없음)'}</p>
            <div className="mt-3 space-y-1 text-sm text-zinc-700">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p>
                  보낸사람:{' '}
                  {detail.from_name
                    ? `${detail.from_name} <${detail.from_email || '-'}>`
                    : detail.from_email || '-'}
                </p>
                <p className="text-xs text-zinc-500">{formatKSTDateTimeKorean(detail.received_at || detail.sent_at)}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRecipients((prev) => !prev)}
                className="text-xs font-medium text-zinc-600 hover:text-zinc-800 hover:underline"
              >
                {showRecipients ? '수신자 숨기기' : '수신자 보기'}
              </button>
              {showRecipients ? <p>받는사람: {detail.to_emails.join(', ') || '-'}</p> : null}
            </div>
          </div>

          {composeMode ? (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-900">{composeMode === 'reply' ? '답장 작성' : '전달 작성'}</p>
                <button
                  type="button"
                  onClick={() => setComposeMode(null)}
                  className="text-xs font-medium text-zinc-600 hover:text-zinc-800 hover:underline"
                >
                  닫기
                </button>
              </div>
              <div className="space-y-2">
                <input
                  value={toRaw}
                  onChange={(e) => setToRaw(e.target.value)}
                  placeholder={composeMode === 'reply' ? '추가 받는사람 (콤마 구분)' : '받는사람 (콤마 구분)'}
                  className="h-9 w-full rounded border border-zinc-300 px-2 text-sm"
                />
                <input
                  value={ccRaw}
                  onChange={(e) => setCcRaw(e.target.value)}
                  placeholder="참조 (콤마 구분)"
                  className="h-9 w-full rounded border border-zinc-300 px-2 text-sm"
                />
                <input
                  value={bccRaw}
                  onChange={(e) => setBccRaw(e.target.value)}
                  placeholder="숨은참조 (콤마 구분)"
                  className="h-9 w-full rounded border border-zinc-300 px-2 text-sm"
                />
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="제목"
                  className="h-9 w-full rounded border border-zinc-300 px-2 text-sm"
                />
                <textarea
                  rows={7}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="본문"
                  className="w-full rounded border border-zinc-300 px-2 py-2 text-sm"
                />
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <select
                    className="h-9 rounded border border-zinc-300 px-2 text-sm"
                    value={attachmentMode}
                    onChange={(e) => setAttachmentMode(e.target.value as 'attachment' | 'secure_link')}
                  >
                    <option value="attachment">첨부파일 직접 첨부</option>
                    <option value="secure_link">보안링크 첨부</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={secureLinkExpireDays}
                    onChange={(e) => setSecureLinkExpireDays(Math.max(1, Number(e.target.value) || 1))}
                    disabled={attachmentMode !== 'secure_link'}
                    className="h-9 rounded border border-zinc-300 px-2 text-sm"
                    placeholder="보안링크 만료일(일)"
                  />
                  <input
                    type="number"
                    min={1}
                    value={secureLinkMaxDownloadCount}
                    onChange={(e) => setSecureLinkMaxDownloadCount(Math.max(1, Number(e.target.value) || 1))}
                    disabled={attachmentMode !== 'secure_link'}
                    className="h-9 rounded border border-zinc-300 px-2 text-sm"
                    placeholder="최대 다운로드 횟수"
                  />
                </div>
                {composeMode === 'forward' ? (
                  <div className="flex items-center gap-4 text-xs text-zinc-600">
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={includeOriginalBody}
                        onChange={(e) => setIncludeOriginalBody(e.target.checked)}
                      />
                      원문 포함
                    </label>
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={includeOriginalAttachments}
                        onChange={(e) => setIncludeOriginalAttachments(e.target.checked)}
                      />
                      원본 첨부 포함
                    </label>
                  </div>
                ) : null}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleSendComposer()}
                    disabled={sending}
                    className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {sending ? '전송 중...' : composeMode === 'reply' ? '답장 전송' : '전달 전송'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
            {detail.body_html_rendered || detail.body_html ? (
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderedMail.sanitizedHtml }} />
            ) : (
              <pre className="whitespace-pre-wrap break-words font-sans text-sm text-zinc-800">{detail.body_text || '-'}</pre>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-zinc-900">첨부파일</p>
              <label className="inline-flex items-center gap-1 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={includeInlineAttachments}
                  onChange={(e) => setIncludeInlineAttachments(e.target.checked)}
                />
                인라인 포함 보기
              </label>
            </div>
            {renderedMail.visibleAttachments.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">첨부파일이 없습니다.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {renderedMail.visibleAttachments.map((attachment) => (
                  <div key={attachment.id} className="rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700">
                    <p className="truncate text-zinc-900">{attachment.original_file_name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {attachment.download_status}
                      {attachment.mime_type ? ` · ${attachment.mime_type}` : ''}
                      {attachment.file_size ? ` · ${attachment.file_size.toLocaleString()} bytes` : ''}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      {attachment.download_status !== 'downloaded' ? (
                        <button
                          type="button"
                          onClick={() => void handleImportAttachment(attachment.id)}
                          disabled={attachmentActionLoadingId === attachment.id}
                          className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                        >
                          {attachmentActionLoadingId === attachment.id ? '가져오는 중...' : '가져오기'}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleOpenAttachment(attachment.id, 'preview')}
                            disabled={attachmentActionLoadingId === attachment.id}
                            className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                          >
                            미리보기
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleOpenAttachment(attachment.id, 'download')}
                            disabled={attachmentActionLoadingId === attachment.id}
                            className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                          >
                            다운로드
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
