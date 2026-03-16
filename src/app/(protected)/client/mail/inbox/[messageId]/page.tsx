'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { formatKSTDateTimeKorean } from '@/utils/dateTime'
import { isInlineMailAttachment, sanitizeMailBodyHtml } from '@/utils/mailBodyHtml'
import { emitMailCountsRefresh } from '@/utils/mailSidebarEvents'
import { fetchClientCompanyTaxList } from '@/services/client/company'
import {
  getMailForwardDraft,
  getClientMailErrorMessage,
  importMailAttachments,
  listMailFolders,
  listMailAttachments,
  getMailMessageDetail,
  getMailReplyDraft,
  moveMailMessageToFolder,
  moveMailMessageToTrash,
  purgeMailMessage,
  restoreMailMessageFromTrash,
  sendMailForward,
  sendMailReply,
  saveMailAttachmentsToCompany,
  updateMailMessageRead,
} from '@/services/client/clientMailService'
import type { MailForwardDraftResponse, MailMessageDetail, MailReplyDraftResponse } from '@/types/adminMail'

function parseEmails(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

function formatAttachmentSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const precision = value >= 100 || unitIndex === 0 ? 0 : 1
  return `${value.toFixed(precision)} ${units[unitIndex]}`
}

function isPreviewableAttachment(attachment: MailMessageDetail['attachments'][number]): boolean {
  const mime = (attachment.mime_type || '').toLowerCase()
  if (mime.startsWith('image/')) return true
  if (mime === 'application/pdf') return true
  if (mime.startsWith('text/')) return true
  if (mime === 'application/json' || mime === 'application/xml' || mime === 'application/csv') return true
  if (mime.startsWith('audio/') || mime.startsWith('video/')) return true

  const fileName = (attachment.original_file_name || '').toLowerCase()
  const ext = fileName.includes('.') ? fileName.split('.').pop() || '' : ''
  const previewableExt = new Set([
    'jpg',
    'jpeg',
    'png',
    'gif',
    'webp',
    'svg',
    'pdf',
    'txt',
    'csv',
    'json',
    'xml',
    'mp3',
    'wav',
    'ogg',
    'mp4',
    'webm',
  ])
  return previewableExt.has(ext)
}

export default function ClientMailMessageDetailPage() {
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
  const companySearchRequestSeqRef = useRef(0)
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
  const [attachmentActionLoadingId, setAttachmentActionLoadingId] = useState<number | null>(null)
  const [previewPanelOpen, setPreviewPanelOpen] = useState(false)
  const [previewPanelUrl, setPreviewPanelUrl] = useState<string | null>(null)
  const [previewPanelDownloadUrl, setPreviewPanelDownloadUrl] = useState<string | null>(null)
  const [previewPanelTitle, setPreviewPanelTitle] = useState('첨부파일 미리보기')
  const [movePanelOpen, setMovePanelOpen] = useState(false)
  const [moveFolderId, setMoveFolderId] = useState('')
  const [moveLoading, setMoveLoading] = useState(false)
  const [folders, setFolders] = useState<Array<{ id: number; name: string }>>([])
  const [companySavePanelOpen, setCompanySavePanelOpen] = useState(false)
  const [companyOptionsLoading, setCompanyOptionsLoading] = useState(false)
  const [companySaveLoading, setCompanySaveLoading] = useState(false)
  const [companyOptionsError, setCompanyOptionsError] = useState<string | null>(null)
  const [companyOptions, setCompanyOptions] = useState<Array<{ id: number; company_name: string; registration_number?: string }>>([])
  const [companyKeyword, setCompanyKeyword] = useState('')
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [selectedAttachment, setSelectedAttachment] = useState<MailMessageDetail['attachments'][number] | null>(null)
  const [autoImportIfMissing, setAutoImportIfMissing] = useState(true)
  const [companySaveTitle, setCompanySaveTitle] = useState('')

  const backHref = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (!params.get('account_id') && typeof detail?.mail_account_id === 'number') {
      params.set('account_id', String(detail.mail_account_id))
    }
    const query = params.toString()
    return query ? `/client/mail/inbox?${query}` : '/client/mail/inbox'
  }, [detail?.mail_account_id, searchParams])
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
  const effectiveMailAccountId = scopedMailAccountId ?? (typeof detail?.mail_account_id === 'number' ? detail.mail_account_id : undefined)

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
        listMailAttachments(messageId, false, scopedMailAccountId).catch(() => ({ items: [] })),
      ])
      setDetail(mergeDetailAttachments(detailRes, attachmentRes.items || []))
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(getClientMailErrorMessage(error))
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDetail()
  }, [messageId, scopedMailAccountId])

  useEffect(() => {
    const loadFolders = async () => {
      try {
        const res = await listMailFolders(true, effectiveMailAccountId)
        setFolders((res.items || []).map((item) => ({ id: item.id, name: item.name })))
      } catch {
        setFolders([])
      }
    }
    void loadFolders()
  }, [effectiveMailAccountId])

  useEffect(() => {
    if (!detail || detail.is_read) return
    if (autoReadDoneRef.current === detail.id) return
    autoReadDoneRef.current = detail.id
    void updateMailMessageRead(detail.id, true, scopedMailAccountId)
      .then(() => {
        setDetail((prev) => (prev ? { ...prev, is_read: true } : prev))
        emitMailCountsRefresh()
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
      toast.error(getClientMailErrorMessage(error))
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
      toast.error(getClientMailErrorMessage(error))
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
      toast.error(getClientMailErrorMessage(error))
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
      emitMailCountsRefresh()
      toast.success(detail.is_read ? '안읽음 처리되었습니다.' : '읽음 처리되었습니다.')
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    } finally {
      setReadUpdating(false)
    }
  }

  const handleMoveTrash = async () => {
    if (!detail) return
    try {
      await moveMailMessageToTrash(detail.id, scopedMailAccountId)
      emitMailCountsRefresh()
      toast.success('휴지통으로 이동했습니다.')
      router.replace(backHref)
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    }
  }

  const handleRestore = async () => {
    if (!detail) return
    try {
      await restoreMailMessageFromTrash(detail.id, scopedMailAccountId)
      emitMailCountsRefresh()
      toast.success('복구되었습니다.')
      router.replace(backHref)
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    }
  }

  const handlePurge = async () => {
    if (!detail) return
    if (!window.confirm('완전삭제 후 복구할 수 없습니다. 삭제할까요?')) return
    try {
      await purgeMailMessage(detail.id, scopedMailAccountId)
      emitMailCountsRefresh()
      toast.success('완전삭제되었습니다.')
      router.replace(backHref)
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    }
  }

  const refreshAttachmentById = async (attachmentId: number) => {
    if (!detail) return null
    const [detailRes, attachmentRes] = await Promise.all([
      getMailMessageDetail(detail.id, scopedMailAccountId),
      listMailAttachments(detail.id, false, scopedMailAccountId),
    ])
    const merged = mergeDetailAttachments(detailRes, attachmentRes.items || [])
    setDetail(merged)
    return merged.attachments.find((item) => item.id === attachmentId) || null
  }

  const handleImportAttachment = async (attachmentId: number) => {
    if (!detail) return
    try {
      setAttachmentActionLoadingId(attachmentId)
      const importResult = await importMailAttachments(detail.id, { attachment_ids: [attachmentId] })
      const itemResult = importResult.results?.find((row) => row.attachment_id === attachmentId)
      const refreshed = await refreshAttachmentById(attachmentId)
      const isDownloaded = refreshed?.download_status === 'downloaded'

      if (isDownloaded) {
        toast.success('첨부파일을 가져왔습니다.')
        return
      }

      if (itemResult?.status === 'skipped') {
        toast.error(itemResult.detail || '첨부파일을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }

      if (itemResult?.status === 'failed') {
        toast.error(itemResult.detail || '첨부파일 가져오기에 실패했습니다.')
        return
      }

      toast.error('첨부파일 가져오기가 완료되지 않았습니다. 다시 시도해 주세요.')
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
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
    if (mode === 'preview' && !isPreviewableAttachment(current)) {
      toast.error('이 파일 형식은 미리보기를 지원하지 않습니다. 다운로드해 주세요.')
      return
    }
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
      if (mode === 'preview') {
        setPreviewPanelTitle(refreshed.original_file_name || '첨부파일 미리보기')
        setPreviewPanelUrl(targetUrl)
        setPreviewPanelDownloadUrl(downloadUrl)
        setPreviewPanelOpen(true)
        return
      }
      window.open(targetUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    } finally {
      setAttachmentActionLoadingId(null)
    }
  }

  const closePreviewPanel = () => {
    setPreviewPanelOpen(false)
    setPreviewPanelUrl(null)
    setPreviewPanelDownloadUrl(null)
  }

  const handleMoveToFolder = async () => {
    if (!detail) return
    const folderIdValue = moveFolderId.trim()
    if (!folderIdValue) {
      toast.error('이동할 폴더를 선택해 주세요.')
      return
    }
    const targetFolderId: number | null = folderIdValue === 'inbox' ? null : Number(folderIdValue)
    if (targetFolderId !== null && (!Number.isFinite(targetFolderId) || targetFolderId <= 0)) {
      toast.error('이동할 폴더를 다시 선택해 주세요.')
      return
    }
    try {
      setMoveLoading(true)
      await moveMailMessageToFolder(detail.id, { folder_id: targetFolderId }, effectiveMailAccountId)
      emitMailCountsRefresh()
      toast.success('폴더로 이동했습니다.')
      setMovePanelOpen(false)
      router.replace(backHref)
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        toast.error('서버에 메일 폴더 이동 API가 아직 배포되지 않았습니다.')
        return
      }
      toast.error(getClientMailErrorMessage(error))
    } finally {
      setMoveLoading(false)
    }
  }

  const loadCompanyOptions = async (keyword?: string) => {
    const requestSeq = ++companySearchRequestSeqRef.current
    const PAGE_LIMIT = 100
    const MAX_RESULTS = 500
    try {
      setCompanyOptionsLoading(true)
      setCompanyOptionsError(null)
      const normalizedKeyword = keyword?.trim() || undefined
      const collected: Array<{ id: number; company_name: string; registration_number?: string }> = []
      let page = 1
      let expectedTotal = 0

      while (collected.length < MAX_RESULTS) {
        const response = await fetchClientCompanyTaxList({
          page,
          limit: PAGE_LIMIT,
          keyword: normalizedKeyword,
        })
        if (requestSeq !== companySearchRequestSeqRef.current) return
        const items = response.items || []
        expectedTotal = response.total || items.length

        collected.push(
          ...items.map((item) => ({
            id: item.id,
            company_name: item.company_name || `업체 #${item.id}`,
            registration_number: item.registration_number || '',
          }))
        )

        if (items.length < PAGE_LIMIT) break
        if (collected.length >= expectedTotal) break
        page += 1
      }

      const uniqueById = new Map<number, { id: number; company_name: string; registration_number?: string }>()
      for (const item of collected) {
        uniqueById.set(item.id, item)
      }
      const mapped = Array.from(uniqueById.values())
        .map((item) => ({
          id: item.id,
          company_name: item.company_name || `업체 #${item.id}`,
          registration_number: item.registration_number || '',
        }))
        .sort((a, b) => a.company_name.localeCompare(b.company_name, 'ko'))
      setCompanyOptions(mapped)
    } catch (error) {
      if (requestSeq !== companySearchRequestSeqRef.current) return
      setCompanyOptionsError(getClientMailErrorMessage(error))
    } finally {
      if (requestSeq !== companySearchRequestSeqRef.current) return
      setCompanyOptionsLoading(false)
    }
  }

  const openCompanySavePanel = async (attachment: MailMessageDetail['attachments'][number]) => {
    if (attachment.scan_status === 'infected' || attachment.scan_status === 'error') {
      toast.error('보안 검사 결과로 저장할 수 없는 첨부파일입니다.')
      return
    }
    setSelectedAttachment(attachment)
    setSelectedCompanyId(null)
    setCompanyKeyword('')
    setAutoImportIfMissing(true)
    setCompanySaveTitle('')
    setCompanySavePanelOpen(true)
    await loadCompanyOptions('')
  }

  const closeCompanySavePanel = () => {
    if (companySaveLoading) return
    setCompanySavePanelOpen(false)
    setSelectedAttachment(null)
    setSelectedCompanyId(null)
    setCompanyKeyword('')
    setCompanySaveTitle('')
  }

  useEffect(() => {
    if (!companySavePanelOpen) return
    const timer = window.setTimeout(() => {
      void loadCompanyOptions(companyKeyword)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [companyKeyword, companySavePanelOpen])

  const filteredCompanyOptions = useMemo(() => {
    const keyword = companyKeyword.trim().toLowerCase()
    if (!keyword) return companyOptions
    return companyOptions.filter((company) => {
      const name = company.company_name.toLowerCase()
      const reg = (company.registration_number || '').toLowerCase()
      return name.includes(keyword) || reg.includes(keyword)
    })
  }, [companyOptions, companyKeyword])

  const handleSaveAttachmentToCompany = async () => {
    if (!detail || !selectedAttachment) return
    if (!selectedCompanyId) {
      toast.error('저장할 고객사를 선택해 주세요.')
      return
    }

    try {
      setCompanySaveLoading(true)
      const normalizedTitle = companySaveTitle.trim()
      await saveMailAttachmentsToCompany(detail.id, {
        company_id: selectedCompanyId,
        attachment_ids: [selectedAttachment.id],
        auto_import_if_missing: autoImportIfMissing,
        title: normalizedTitle || undefined,
        title_by_attachment_id: normalizedTitle ? { [selectedAttachment.id]: normalizedTitle } : undefined,
      })
      toast.success('고객사 기타문서로 저장했습니다.')
      closeCompanySavePanel()
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    } finally {
      setCompanySaveLoading(false)
    }
  }

  const renderedMail = useMemo(() => {
    const attachments = detail?.attachments || []
    const htmlSource = detail?.body_html_rendered || detail?.body_html || ''
    return {
      sanitizedHtml: sanitizeMailBodyHtml(htmlSource, attachments),
      visibleAttachments: attachments.filter((attachment) => !isInlineMailAttachment(attachment)),
    }
  }, [detail?.body_html, detail?.body_html_rendered, detail?.attachments])

  return (
    <>
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
            {!detail.is_deleted ? (
              <button
                type="button"
                onClick={() => {
                  setMoveFolderId('')
                  setMovePanelOpen(true)
                }}
                className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                이동
              </button>
            ) : null}
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

          <div className="mt-2 rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-zinc-900">첨부파일</p>
            </div>
            {renderedMail.visibleAttachments.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">첨부파일이 없습니다.</p>
            ) : (
              <div className="mt-2 space-y-1">
                {renderedMail.visibleAttachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="inline-flex max-w-full items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700"
                  >
                    <p className="max-w-[24rem] truncate text-zinc-900">{attachment.original_file_name}</p>
                    <p className="whitespace-nowrap text-xs text-zinc-500">{formatAttachmentSize(attachment.file_size)}</p>
                    <div className="flex items-center gap-2">
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
                          {isPreviewableAttachment(attachment) ? (
                            <button
                              type="button"
                              onClick={() => void handleOpenAttachment(attachment.id, 'preview')}
                              disabled={attachmentActionLoadingId === attachment.id}
                              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                            >
                              미리보기
                            </button>
                          ) : null}
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
                      <button
                        type="button"
                        onClick={() => void openCompanySavePanel(attachment)}
                        className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                      >
                        고객사 저장
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-2 rounded-xl border border-zinc-200 bg-white p-4">
            {detail.body_html_rendered || detail.body_html ? (
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderedMail.sanitizedHtml }} />
            ) : (
              <pre className="whitespace-pre-wrap break-words font-sans text-sm text-zinc-800">{detail.body_text || '-'}</pre>
            )}
          </div>
        </div>
      )}
      </section>

      {previewPanelOpen && previewPanelUrl ? (
        <div className="fixed inset-0 z-50 flex bg-black/20">
          <button type="button" className="flex-1 cursor-default" onClick={closePreviewPanel} aria-label="미리보기 닫기" />
          <aside className="h-full w-full max-w-3xl border-l border-zinc-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2">
              <p className="truncate pr-3 text-sm font-semibold text-zinc-900">{previewPanelTitle}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.open(previewPanelUrl, '_blank', 'noopener,noreferrer')}
                  className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                >
                  새 창으로 보기
                </button>
                <button
                  type="button"
                  onClick={() => previewPanelDownloadUrl && window.open(previewPanelDownloadUrl, '_blank', 'noopener,noreferrer')}
                  disabled={!previewPanelDownloadUrl}
                  className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  다운로드
                </button>
                <button
                  type="button"
                  onClick={closePreviewPanel}
                  className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                >
                  닫기
                </button>
              </div>
            </div>
            <iframe title="첨부파일 미리보기" src={previewPanelUrl} className="h-[calc(100%-49px)] w-full" />
          </aside>
        </div>
      ) : null}

      {companySavePanelOpen ? (
        <div className="fixed inset-0 z-50 flex bg-black/20">
          <button type="button" className="flex-1 cursor-default" onClick={closeCompanySavePanel} aria-label="고객사 저장 닫기" />
          <aside className="h-full w-full max-w-md border-l border-zinc-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <p className="text-sm font-semibold text-zinc-900">고객사 기타문서 저장</p>
              <button
                type="button"
                onClick={closeCompanySavePanel}
                className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                닫기
              </button>
            </div>
            <div className="space-y-4 p-4">
              <div>
                <p className="text-xs text-zinc-500">파일명</p>
                <p className="mt-1 rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-900">
                  {selectedAttachment?.original_file_name || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">저장 제목(선택)</p>
                <input
                  value={companySaveTitle}
                  onChange={(e) => setCompanySaveTitle(e.target.value)}
                  placeholder="비우면 기본 제목으로 저장됩니다."
                  className="mt-1 h-9 w-full rounded border border-zinc-300 px-2 text-sm"
                />
              </div>
              <div>
                <p className="text-xs text-zinc-500">고객사 검색</p>
                <input
                  value={companyKeyword}
                  onChange={(e) => setCompanyKeyword(e.target.value)}
                  placeholder="업체명 또는 사업자번호"
                  className="mt-1 h-9 w-full rounded border border-zinc-300 px-2 text-sm"
                />
              </div>
              <div>
                <p className="text-xs text-zinc-500">고객사 선택</p>
                <div className="mt-1 max-h-64 overflow-y-auto rounded border border-zinc-200">
                  {companyOptionsLoading ? (
                    <p className="px-3 py-2 text-sm text-zinc-500">고객사 목록을 불러오는 중...</p>
                  ) : companyOptionsError ? (
                    <p className="px-3 py-2 text-sm text-rose-600">{companyOptionsError}</p>
                  ) : filteredCompanyOptions.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-zinc-500">검색 결과가 없습니다.</p>
                  ) : (
                    filteredCompanyOptions.map((company) => (
                      <label key={company.id} className="flex cursor-pointer items-center gap-2 border-b border-zinc-100 px-3 py-2 last:border-b-0">
                        <input
                          type="radio"
                          name="company-save-target-client"
                          checked={selectedCompanyId === company.id}
                          onChange={() => setSelectedCompanyId(company.id)}
                        />
                        <span className="min-w-0 text-sm text-zinc-800">
                          <span className="block truncate">{company.company_name}</span>
                          <span className="block text-xs text-zinc-500">{company.registration_number || '-'}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={autoImportIfMissing}
                  onChange={(e) => setAutoImportIfMissing(e.target.checked)}
                />
                첨부 미가져오기 상태면 자동으로 가져온 뒤 저장
              </label>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleSaveAttachmentToCompany()}
                  disabled={companySaveLoading || companyOptionsLoading}
                  className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {companySaveLoading ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {movePanelOpen ? (
        <div className="fixed inset-0 z-50 flex bg-black/20">
          <button type="button" className="flex-1 cursor-default" onClick={() => setMovePanelOpen(false)} aria-label="폴더 이동 닫기" />
          <aside className="h-full w-full max-w-md border-l border-zinc-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <p className="text-sm font-semibold text-zinc-900">폴더 이동</p>
              <button
                type="button"
                onClick={() => setMovePanelOpen(false)}
                className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                닫기
              </button>
            </div>
            <div className="space-y-3 p-4">
              <p className="text-xs text-zinc-500">이동할 폴더</p>
              <select
                value={moveFolderId}
                onChange={(e) => setMoveFolderId(e.target.value)}
                className="h-9 w-full rounded border border-zinc-300 px-2 text-sm"
              >
                <option value="">폴더 선택</option>
                <option value="inbox">받은메일함(INBOX)</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={String(folder.id)}>
                    {folder.name}
                  </option>
                ))}
              </select>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleMoveToFolder()}
                  disabled={moveLoading || !moveFolderId.trim()}
                  className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {moveLoading ? '이동 중...' : '이동'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  )
}
