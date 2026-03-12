'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Mail, MailOpen, Paperclip, RefreshCw } from 'lucide-react'
import { toast } from 'react-hot-toast'
import UiButton from '@/components/common/UiButton'
import { formatKSTDateTime, formatKSTDateTimeMinute } from '@/utils/dateTime'
import { isInlineMailAttachment, sanitizeMailBodyHtml } from '@/utils/mailBodyHtml'
import { emitMailCountsRefresh } from '@/utils/mailSidebarEvents'
import { resolveMailSnippet } from '@/utils/mailSnippet'
import {
  bulkMoveMailMessagesToFolder,
  createMailFolder,
  createMailRule,
  getMailReplyDraft,
  getMailMessageCompanyCandidates,
  getClientMailErrorMessage,
  listMailAttachments,
  moveMailMessageToTrash,
  purgeMailMessage,
  getMailMessageDetail,
  importMailAttachments,
  linkMailMessageCompany,
  listMailAccounts,
  listMailFolders,
  listMailMessages,
  syncMailAccount,
  reprocessMailMessageRules,
  restoreMailMessageFromTrash,
  sendMailReply,
  unlinkMailMessageCompany,
  updateMailMessageRead,
} from '@/services/client/clientMailService'
import type {
  MailAccount,
  MailFolder,
  MailMessage,
  MailMessageDetail,
  MailMessageListParams,
  MailReplyDraftResponse,
} from '@/types/adminMail'

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'
const BULK_READ_FETCH_SIZE = 100
const BULK_UPDATE_CHUNK_SIZE = 30
const PAGE_GROUP_SIZE = 5

function parseEmails(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

export default function ClientMailInboxPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [accounts, setAccounts] = useState<MailAccount[]>([])
  const [folders, setFolders] = useState<MailFolder[]>([])
  const [messages, setMessages] = useState<MailMessage[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [size] = useState(20)
  const [mailAccountId, setMailAccountId] = useState<number | ''>('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null)
  const [selectedMessageIds, setSelectedMessageIds] = useState<number[]>([])
  const [detail, setDetail] = useState<MailMessageDetail | null>(null)
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<number[]>([])
  const [linkCompanyId, setLinkCompanyId] = useState('')
  const [apiNotice, setApiNotice] = useState<string | null>(null)
  const [readUpdating, setReadUpdating] = useState(false)
  const [bulkReadAllLoading, setBulkReadAllLoading] = useState(false)
  const [candidateLoading, setCandidateLoading] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
  const [replyLoading, setReplyLoading] = useState(false)
  const [replySending, setReplySending] = useState(false)
  const [replyMode, setReplyMode] = useState<'reply' | 'reply_all'>('reply')
  const [replyDraft, setReplyDraft] = useState<MailReplyDraftResponse | null>(null)
  const [replyCompanyId, setReplyCompanyId] = useState('')
  const [replySubject, setReplySubject] = useState('')
  const [replyBodyText, setReplyBodyText] = useState('')
  const [replyToRaw, setReplyToRaw] = useState('')
  const [replyCcRaw, setReplyCcRaw] = useState('')
  const [replyBccRaw, setReplyBccRaw] = useState('')
  const [replyQueueOnFail, setReplyQueueOnFail] = useState(true)
  const [includeInlineAttachments, setIncludeInlineAttachments] = useState(false)
  const [attachmentActionLoadingId, setAttachmentActionLoadingId] = useState<number | null>(null)
  const [includeTrash, setIncludeTrash] = useState(false)
  const [activeMailbox, setActiveMailbox] = useState<'all' | 'inbox' | 'sent' | 'spam' | 'custom'>('all')
  const [activeFolderName, setActiveFolderName] = useState('')
  const [readFilter, setReadFilter] = useState<'' | 'read' | 'unread'>('')
  const [bulkMoveFolderId, setBulkMoveFolderId] = useState('')
  const [bulkMoveFolders, setBulkMoveFolders] = useState<MailFolder[]>([])
  const [manualSyncLoading, setManualSyncLoading] = useState(false)
  const [candidates, setCandidates] = useState<Array<{ company_id: number; company_name: string; score: number; reasons: string[]; already_linked: boolean }>>([])
  const totalPages = Math.max(1, Math.ceil(total / size))
  const currentStart = total === 0 ? 0 : (page - 1) * size + 1
  const currentEnd = total === 0 ? 0 : Math.min(page * size, total)
  const pageGroupStart = Math.floor((page - 1) / PAGE_GROUP_SIZE) * PAGE_GROUP_SIZE + 1
  const pageGroupEnd = Math.min(pageGroupStart + PAGE_GROUP_SIZE - 1, totalPages)
  const visiblePages = Array.from(
    { length: pageGroupEnd - pageGroupStart + 1 },
    (_, index) => pageGroupStart + index
  )
  const searchParams = useSearchParams()
  const listRequestSeqRef = useRef(0)
  const currentAccount =
    typeof mailAccountId === 'number' ? accounts.find((account) => account.id === mailAccountId) || null : null
  const scopedMailAccountId = typeof mailAccountId === 'number' ? mailAccountId : undefined

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

  const loadAccounts = async () => {
    try {
      const res = await listMailAccounts(true)
      setAccounts(res.items || [])
      setMailAccountId((prev) => {
        const items = res.items || []
        if (items.length === 0) return ''
        const requested = Number(searchParams.get('account_id') || '')
        if (Number.isFinite(requested) && requested > 0 && items.some((item) => item.id === requested)) {
          return requested
        }
        if (typeof prev === 'number' && items.some((item) => item.id === prev)) {
          return prev
        }
        return items[0].id
      })
    } catch (error) {
      const message = getClientMailErrorMessage(error)
      setApiNotice(message)
      setAccounts([])
    }
  }

  const loadFolders = async () => {
    try {
      const res = await listMailFolders(true, typeof mailAccountId === 'number' ? mailAccountId : undefined)
      setFolders(res.items || [])
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
      setFolders([])
    }
  }

  const loadMessages = async (targetPage = page) => {
    const requestSeq = ++listRequestSeqRef.current
    try {
      setLoading(true)
      const res = await listMailMessages(buildMessageListParams(targetPage, size))
      if (requestSeq !== listRequestSeqRef.current) return
      setMessages(res.items || [])
      setTotal(res.total || 0)
      setApiNotice(null)
    } catch (error) {
      if (requestSeq !== listRequestSeqRef.current) return
      const message = getClientMailErrorMessage(error)
      setApiNotice(message)
      setMessages([])
      setTotal(0)
    } finally {
      if (requestSeq !== listRequestSeqRef.current) return
      setLoading(false)
    }
  }

  const buildMessageListParams = (
    targetPage: number,
    targetSize: number,
    forcedRead: boolean | undefined = undefined
  ): MailMessageListParams => {
    const requestMailboxType = includeTrash ? undefined : activeMailbox === 'inbox' ? 'inbox' : 'all'
    const requestDirection = includeTrash ? undefined : activeMailbox === 'sent' ? 'outbound' : undefined
    const requestFolderName =
      includeTrash || activeMailbox === 'inbox' || activeMailbox === 'all' || activeMailbox === 'sent'
        ? undefined
        : activeMailbox === 'spam'
          ? activeFolderName || '스팸'
          : activeFolderName.trim() || undefined
    return {
      page: targetPage,
      size: targetSize,
      mail_account_id: typeof mailAccountId === 'number' ? mailAccountId : undefined,
      mailbox_type: requestMailboxType,
      direction: requestDirection,
      is_read:
        typeof forcedRead === 'boolean'
          ? forcedRead
          : readFilter === 'read'
            ? true
            : readFilter === 'unread'
              ? false
              : undefined,
      folder_name: requestFolderName,
      keyword: keyword.trim() || undefined,
      include_trash: includeTrash,
    }
  }

  const loadMessageDetail = async (messageId: number) => {
    try {
      setDetailLoading(true)
      const [detailRes, attachmentRes] = await Promise.all([
        getMailMessageDetail(messageId, scopedMailAccountId),
        listMailAttachments(messageId, includeInlineAttachments, scopedMailAccountId).catch(() => ({ items: [] })),
      ])
      setDetail(mergeDetailAttachments(detailRes, attachmentRes.items || []))
      setSelectedAttachmentIds([])
      setReplyDraft(null)
      setReplyBodyText('')
      setReplyToRaw('')
      setReplyCcRaw('')
      setReplyBccRaw('')
      setApiNotice(null)
    } catch (error) {
      const message = getClientMailErrorMessage(error)
      setApiNotice(message)
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  useEffect(() => {
    void loadFolders()
  }, [mailAccountId])

  useEffect(() => {
    const mailbox = searchParams.get('mailbox')
    const accountIdParam = searchParams.get('account_id')
    const folderParam = searchParams.get('folder')
    const keywordParam = searchParams.get('q')
    const readParam = searchParams.get('read')

    setKeyword(keywordParam ?? '')
    if (readParam === 'read' || readParam === 'unread') setReadFilter(readParam)
    else setReadFilter('')
    if (accountIdParam) {
      const parsed = Number(accountIdParam)
      if (Number.isFinite(parsed) && parsed > 0) {
        setMailAccountId(parsed)
      }
    } else {
      setMailAccountId('')
    }

    if (mailbox === 'trash') {
      setIncludeTrash(true)
      setActiveMailbox('all')
      setActiveFolderName('')
      return
    }
    setIncludeTrash(false)
    if (mailbox === 'inbox') {
      setActiveMailbox('inbox')
      setActiveFolderName('')
      return
    }
    if (mailbox === 'sent') {
      setActiveMailbox('sent')
      setActiveFolderName('')
      return
    }
    if (mailbox === 'custom') {
      setActiveMailbox('custom')
      setActiveFolderName(folderParam ?? '')
      return
    }
    setActiveMailbox('all')
    setActiveFolderName('')
  }, [searchParams])

  useEffect(() => {
    loadMessages(1)
    setPage(1)
  }, [mailAccountId, activeMailbox, activeFolderName, readFilter, includeTrash, keyword])

  useEffect(() => {
    loadMessages(page)
  }, [page])

  useEffect(() => {
    if (!selectedMessageId) return
    loadMessageDetail(selectedMessageId)
  }, [selectedMessageId, scopedMailAccountId, includeInlineAttachments])

  useEffect(() => {
    setSelectedMessageIds((prev) => prev.filter((id) => messages.some((item) => item.id === id)))
  }, [messages])

  const renderedMail = useMemo(() => {
    const attachments = detail?.attachments || []
    const htmlSource = detail?.body_html_rendered || detail?.body_html || ''
    const visibleAttachments = includeInlineAttachments
      ? attachments
      : attachments.filter((attachment) => !isInlineMailAttachment(attachment))
    const visibleAttachmentIdSet = new Set(visibleAttachments.map((attachment) => attachment.id))
    const selectedVisibleAttachmentIds = selectedAttachmentIds.filter((id) => visibleAttachmentIdSet.has(id))
    return {
      sanitizedHtml: sanitizeMailBodyHtml(htmlSource, attachments),
      visibleAttachments,
      selectedVisibleAttachmentIds,
    }
  }, [detail?.body_html, detail?.body_html_rendered, detail?.attachments, selectedAttachmentIds, includeInlineAttachments])

  const selectedAttachmentCount = renderedMail.selectedVisibleAttachmentIds.length
  const isAllCurrentPageSelected = messages.length > 0 && messages.every((message) => selectedMessageIds.includes(message.id))
  const selectedMessageCount = selectedMessageIds.length
  const selectedMessageAccountIds = useMemo(
    () =>
      Array.from(
        new Set(
          messages
            .filter((message) => selectedMessageIds.includes(message.id))
            .map((message) => Number(message.mail_account_id))
            .filter((id) => Number.isFinite(id) && id > 0)
        )
      ),
    [messages, selectedMessageIds]
  )
  const isMultiAccountSelection = selectedMessageAccountIds.length > 1
  const bulkMoveTargetAccountId =
    selectedMessageAccountIds.length === 1
      ? selectedMessageAccountIds[0]
      : typeof scopedMailAccountId === 'number'
        ? scopedMailAccountId
        : null
  const handleLinkCompany = async () => {
    if (!detail) return
    const companyId = Number(linkCompanyId)
    if (!Number.isFinite(companyId) || companyId <= 0) {
      toast.error('연결할 회사 ID를 입력해 주세요.')
      return
    }
    try {
      await linkMailMessageCompany(detail.id, { company_id: companyId, relation_type: 'company' })
      toast.success('고객사 연결이 완료되었습니다.')
      await loadMessageDetail(detail.id)
      setLinkCompanyId('')
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    }
  }

  const handleUnlinkCompany = async (companyId: number) => {
    if (!detail) return
    try {
      await unlinkMailMessageCompany(detail.id, { company_id: companyId, relation_type: 'company' })
      toast.success('고객사 연결을 해제했습니다.')
      await loadMessageDetail(detail.id)
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    }
  }

  const handleToggleAttachment = (attachmentId: number) => {
    setSelectedAttachmentIds((prev) =>
      prev.includes(attachmentId) ? prev.filter((id) => id !== attachmentId) : [...prev, attachmentId]
    )
  }

  const handleImportAttachments = async () => {
    if (!detail || renderedMail.selectedVisibleAttachmentIds.length === 0) {
      toast.error('가져올 첨부파일을 선택해 주세요.')
      return
    }
    try {
      const res = await importMailAttachments(detail.id, {
        attachment_ids: renderedMail.selectedVisibleAttachmentIds,
      })
      const successCount = res.results.filter((item) => item.status === 'downloaded').length
      toast.success(`첨부 import 완료 (${successCount}건)`)
      await loadMessageDetail(detail.id)
      setSelectedAttachmentIds([])
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
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

  const handleImportSingleAttachment = async (attachmentId: number) => {
    if (!detail) return
    try {
      setAttachmentActionLoadingId(attachmentId)
      await importMailAttachments(detail.id, { attachment_ids: [attachmentId] })
      await refreshAttachmentById(attachmentId)
      toast.success('첨부파일을 가져왔습니다.')
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    } finally {
      setAttachmentActionLoadingId(null)
    }
  }

  const handleOpenAttachment = async (attachmentId: number, mode: 'preview' | 'download') => {
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
      toast.error(getClientMailErrorMessage(error))
    } finally {
      setAttachmentActionLoadingId(null)
    }
  }

  const handleToggleRead = async () => {
    if (!detail) return
    const nextRead = !detail.is_read
    try {
      setReadUpdating(true)
      await updateMailMessageRead(detail.id, nextRead, scopedMailAccountId)
      setMessages((prev) => prev.map((item) => (item.id === detail.id ? { ...item, is_read: nextRead } : item)))
      await loadMessageDetail(detail.id)
      emitMailCountsRefresh()
      toast.success(nextRead ? '읽음 처리되었습니다.' : '안읽음 처리되었습니다.')
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    } finally {
      setReadUpdating(false)
    }
  }

  const handleLoadCandidates = async () => {
    if (!detail) return
    try {
      setCandidateLoading(true)
      const res = await getMailMessageCompanyCandidates(detail.id, 5)
      setCandidates(res.items || [])
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
      setCandidates([])
    } finally {
      setCandidateLoading(false)
    }
  }

  const handleReprocess = async () => {
    if (!detail) return
    try {
      setReprocessing(true)
      const res = await reprocessMailMessageRules(detail.id)
      toast.success(`재처리 완료 (${res.matched_rule_total}개 규칙 매칭)`)
      await loadMessageDetail(detail.id)
      await loadMessages(page)
      emitMailCountsRefresh()
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    } finally {
      setReprocessing(false)
    }
  }

  const handleOpenReply = async (mode: 'reply' | 'reply_all') => {
    if (!detail) return
    try {
      setReplyLoading(true)
      const draft = await getMailReplyDraft(detail.id, mode)
      setReplyDraft(draft)
      setReplyMode(mode)
      setReplySubject(draft.subject || '')
      setReplyBodyText('')
      setReplyToRaw('')
      setReplyCcRaw('')
      setReplyBccRaw('')
      const defaultCompanyId = (detail.links || []).find((link) => Boolean(link.company_id))?.company_id
      setReplyCompanyId(defaultCompanyId ? String(defaultCompanyId) : '')
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
      setReplyDraft(null)
    } finally {
      setReplyLoading(false)
    }
  }

  const handleSendReply = async () => {
    if (!detail || !replyDraft) return
    try {
      setReplySending(true)
      const res = await sendMailReply(detail.id, {
        mode: replyMode,
        company_id: replyCompanyId.trim() ? Number(replyCompanyId) : undefined,
        subject: replySubject.trim() || undefined,
        body_text: replyBodyText.trim() || undefined,
        additional_to_emails: parseEmails(replyToRaw),
        additional_cc_emails: parseEmails(replyCcRaw),
        additional_bcc_emails: parseEmails(replyBccRaw),
        queue_on_fail: replyQueueOnFail,
      })
      if (res.status === 'queued') {
        toast.success(`답장 발송 실패로 큐에 등록됨 (작업 #${res.queue_job_id ?? '-'})`)
      } else if (res.status === 'failed') {
        toast.error('답장 발송 실패')
      } else {
        toast.success(`답장 발송 완료 (#${res.mail_message_id ?? '-'})`)
      }
      setReplyBodyText('')
      setReplyToRaw('')
      setReplyCcRaw('')
      setReplyBccRaw('')
      await loadMessages(page)
      emitMailCountsRefresh()
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    } finally {
      setReplySending(false)
    }
  }

  const handleRegisterSpam = async () => {
    if (!detail?.from_email) {
      toast.error('발신자 이메일이 없어 스팸 등록할 수 없습니다.')
      return
    }
    try {
      let spamFolder = folders.find((folder) => {
        const name = folder.name.toLowerCase()
        return name.includes('스팸') || name.includes('spam')
      })
      if (!spamFolder) {
        spamFolder = await createMailFolder({ name: '스팸' })
      }
      await createMailRule({
        name: `스팸-${detail.from_email}`,
        match_field: 'from_email',
        match_operator: 'equals',
        match_value: detail.from_email,
        target_folder_id: spamFolder.id,
        mail_account_id: typeof mailAccountId === 'number' ? mailAccountId : undefined,
        stop_processing: true,
      })
      await reprocessMailMessageRules(detail.id)
      await loadFolders()
      await loadMessages(1)
      await loadMessageDetail(detail.id)
      setActiveMailbox('spam')
      setActiveFolderName(spamFolder.name)
      setReadFilter('')
      toast.success('스팸 규칙 등록 및 즉시 재분류가 완료되었습니다.')
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    }
  }

  const handleTrashMessage = async (messageId: number) => {
    try {
      await moveMailMessageToTrash(messageId, scopedMailAccountId)
      toast.success('메일을 휴지통으로 이동했습니다.')
      if (selectedMessageId === messageId) {
        setSelectedMessageId(null)
        setDetail(null)
      }
      await loadMessages(page)
      emitMailCountsRefresh()
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    }
  }

  const handleRestoreMessage = async (messageId: number) => {
    try {
      await restoreMailMessageFromTrash(messageId, scopedMailAccountId)
      toast.success('메일을 복구했습니다.')
      if (selectedMessageId === messageId) {
        setSelectedMessageId(null)
        setDetail(null)
      }
      await loadMessages(page)
      emitMailCountsRefresh()
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    }
  }

  const handlePurgeMessage = async (messageId: number) => {
    if (!window.confirm('완전삭제한 메일은 복구할 수 없습니다. 삭제할까요?')) return
    try {
      await purgeMailMessage(messageId, scopedMailAccountId)
      toast.success('메일을 완전 삭제했습니다.')
      if (selectedMessageId === messageId) {
        setSelectedMessageId(null)
        setDetail(null)
      }
      await loadMessages(page)
      emitMailCountsRefresh()
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    }
  }

  const handleToggleSelectMessage = (messageId: number) => {
    setSelectedMessageIds((prev) =>
      prev.includes(messageId) ? prev.filter((id) => id !== messageId) : [...prev, messageId]
    )
  }

  const handleToggleSelectAllCurrentPage = () => {
    if (isAllCurrentPageSelected) {
      setSelectedMessageIds((prev) => prev.filter((id) => !messages.some((message) => message.id === id)))
      return
    }
    setSelectedMessageIds((prev) => Array.from(new Set([...prev, ...messages.map((message) => message.id)])))
  }

  const handleBulkUpdateRead = async (isRead: boolean) => {
    if (selectedMessageIds.length === 0) return
    const targetIds = [...selectedMessageIds]
    const results = await Promise.allSettled(
      targetIds.map((id) => updateMailMessageRead(id, isRead, scopedMailAccountId))
    )
    const successCount = results.filter((result) => result.status === 'fulfilled').length
    if (successCount > 0) {
      toast.success(`${isRead ? '읽음' : '안읽음'} 처리 완료 (${successCount}건)`)
    }
    if (successCount < targetIds.length) {
      toast.error(`${targetIds.length - successCount}건 처리 실패`)
    }
    setSelectedMessageIds([])
    await loadMessages(page)
    if (detail && targetIds.includes(detail.id)) {
      await loadMessageDetail(detail.id)
    }
    if (successCount > 0) {
      emitMailCountsRefresh()
    }
  }

  const handleMarkAllUnreadAsRead = async () => {
    if (includeTrash) {
      toast.error('휴지통에서는 사용할 수 없습니다.')
      return
    }
    if (readFilter === 'read') {
      toast('이미 읽은 메일만 보고 있습니다.')
      return
    }
    try {
      setBulkReadAllLoading(true)
      const unreadIds: number[] = []
      let targetPage = 1
      while (true) {
        const res = await listMailMessages(buildMessageListParams(targetPage, BULK_READ_FETCH_SIZE, false))
        const items = res.items || []
        unreadIds.push(...items.map((item) => item.id))
        if (items.length < BULK_READ_FETCH_SIZE) break
        targetPage += 1
      }
      if (unreadIds.length === 0) {
        toast('안읽은 메일이 없습니다.')
        return
      }
      let successCount = 0
      for (let i = 0; i < unreadIds.length; i += BULK_UPDATE_CHUNK_SIZE) {
        const chunk = unreadIds.slice(i, i + BULK_UPDATE_CHUNK_SIZE)
        const results = await Promise.allSettled(
          chunk.map((id) => updateMailMessageRead(id, true, scopedMailAccountId))
        )
        successCount += results.filter((result) => result.status === 'fulfilled').length
      }
      if (successCount > 0) {
        toast.success(`전체 읽음 처리 완료 (${successCount}건)`)
      }
      if (successCount < unreadIds.length) {
        toast.error(`${unreadIds.length - successCount}건 처리 실패`)
      }
      setSelectedMessageIds([])
      await loadMessages(page)
      if (detail && unreadIds.includes(detail.id)) {
        await loadMessageDetail(detail.id)
      }
      if (successCount > 0) {
        emitMailCountsRefresh()
      }
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    } finally {
      setBulkReadAllLoading(false)
    }
  }

  const handleBulkMoveToTrash = async () => {
    if (selectedMessageIds.length === 0) return
    const targetIds = [...selectedMessageIds]
    const results = await Promise.allSettled(targetIds.map((id) => moveMailMessageToTrash(id, scopedMailAccountId)))
    const successCount = results.filter((result) => result.status === 'fulfilled').length
    if (successCount > 0) {
      toast.success(`휴지통 이동 완료 (${successCount}건)`)
    }
    if (successCount < targetIds.length) {
      toast.error(`${targetIds.length - successCount}건 이동 실패`)
    }
    if (selectedMessageId && targetIds.includes(selectedMessageId)) {
      setSelectedMessageId(null)
      setDetail(null)
    }
    setSelectedMessageIds([])
    await loadMessages(page)
    if (successCount > 0) {
      emitMailCountsRefresh()
    }
  }

  const handleBulkRestore = async () => {
    if (selectedMessageIds.length === 0) return
    const targetIds = [...selectedMessageIds]
    const results = await Promise.allSettled(
      targetIds.map((id) => restoreMailMessageFromTrash(id, scopedMailAccountId))
    )
    const successCount = results.filter((result) => result.status === 'fulfilled').length
    if (successCount > 0) {
      toast.success(`복구 완료 (${successCount}건)`)
    }
    if (successCount < targetIds.length) {
      toast.error(`${targetIds.length - successCount}건 복구 실패`)
    }
    if (selectedMessageId && targetIds.includes(selectedMessageId)) {
      setSelectedMessageId(null)
      setDetail(null)
    }
    setSelectedMessageIds([])
    await loadMessages(page)
    if (successCount > 0) {
      emitMailCountsRefresh()
    }
  }

  const handleBulkPurge = async () => {
    if (selectedMessageIds.length === 0) return
    if (!window.confirm('선택한 메일을 완전삭제할까요? 삭제 후 복구할 수 없습니다.')) return
    const targetIds = [...selectedMessageIds]
    const results = await Promise.allSettled(targetIds.map((id) => purgeMailMessage(id, scopedMailAccountId)))
    const successCount = results.filter((result) => result.status === 'fulfilled').length
    if (successCount > 0) {
      toast.success(`완전삭제 완료 (${successCount}건)`)
    }
    if (successCount < targetIds.length) {
      toast.error(`${targetIds.length - successCount}건 삭제 실패`)
    }
    if (selectedMessageId && targetIds.includes(selectedMessageId)) {
      setSelectedMessageId(null)
      setDetail(null)
    }
    setSelectedMessageIds([])
    await loadMessages(page)
    if (successCount > 0) {
      emitMailCountsRefresh()
    }
  }

  const handleBulkMoveToFolder = async () => {
    if (selectedMessageIds.length === 0) return
    if (isMultiAccountSelection) {
      toast.error('서로 다른 계정 메일은 한 번에 이동할 수 없습니다.')
      return
    }
    if (!bulkMoveTargetAccountId) {
      toast.error('이동할 계정을 먼저 선택해 주세요.')
      return
    }
    const folderIdValue = bulkMoveFolderId.trim()
    if (!folderIdValue) {
      toast.error('이동할 폴더를 선택해 주세요.')
      return
    }
    const targetFolderId: number | null = folderIdValue === 'inbox' ? null : Number(folderIdValue)
    if (targetFolderId !== null && (!Number.isFinite(targetFolderId) || targetFolderId <= 0)) {
      toast.error('이동할 폴더를 다시 선택해 주세요.')
      return
    }
    const targetIds = [...selectedMessageIds]
    const moveRes = await bulkMoveMailMessagesToFolder(
      {
        message_ids: targetIds,
        folder_id: targetFolderId,
      },
      bulkMoveTargetAccountId
    )
    const successCount = Number(moveRes.moved_count || 0)
    const failedCount = Number(moveRes.failed_count || 0)
    const failedIds = new Set(
      (moveRes.results || [])
        .filter((result) => result.status === 'failed')
        .map((result) => result.message_id)
    )
    if (successCount > 0) {
      toast.success(`폴더 이동 완료 (${successCount}건)`)
    }
    if (failedCount > 0) {
      toast.error(`${failedCount}건 이동 실패`)
    }
    setSelectedMessageIds(targetIds.filter((id) => failedIds.has(id)))
    setBulkMoveFolderId('')
    await loadMessages(page)
    if (detail && targetIds.includes(detail.id)) {
      await loadMessageDetail(detail.id)
    }
  }

  const handleChangeReadFilter = (next: '' | 'read' | 'unread') => {
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set('read', next)
    else params.delete('read')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  const handleManualSync = async () => {
    const targetAccountId = typeof mailAccountId === 'number' ? mailAccountId : null
    if (!targetAccountId) {
      toast.error('동기화할 메일 계정을 선택해 주세요.')
      return
    }
    try {
      setManualSyncLoading(true)
      await syncMailAccount(targetAccountId, 50)
      await loadMessages(page)
      if (detail) {
        await loadMessageDetail(detail.id)
      }
      emitMailCountsRefresh()
      toast.success('메일 동기화가 완료되었습니다.')
    } catch (error) {
      toast.error(getClientMailErrorMessage(error))
    } finally {
      setManualSyncLoading(false)
    }
  }

  const detailQueryString = useMemo(() => {
    const params = new URLSearchParams()
    if (typeof scopedMailAccountId === 'number') {
      params.set('account_id', String(scopedMailAccountId))
    }
    if (includeTrash) params.set('mailbox', 'trash')
    else if (activeMailbox === 'inbox') params.set('mailbox', 'inbox')
    else if (activeMailbox === 'sent') params.set('mailbox', 'sent')
    else if (activeMailbox === 'custom') {
      params.set('mailbox', 'custom')
      if (activeFolderName.trim()) params.set('folder', activeFolderName.trim())
    } else {
      params.set('mailbox', 'all')
    }
    if (keyword.trim()) params.set('q', keyword.trim())
    if (readFilter) params.set('read', readFilter)
    return params.toString()
  }, [activeFolderName, activeMailbox, includeTrash, keyword, readFilter, scopedMailAccountId])

  useEffect(() => {
    const loadBulkMoveFolders = async () => {
      if (!bulkMoveTargetAccountId || isMultiAccountSelection) {
        setBulkMoveFolders([])
        setBulkMoveFolderId('')
        return
      }
      try {
        const res = await listMailFolders(true, bulkMoveTargetAccountId)
        setBulkMoveFolders(res.items || [])
      } catch {
        setBulkMoveFolders([])
      }
    }
    void loadBulkMoveFolders()
  }, [bulkMoveTargetAccountId, isMultiAccountSelection])

  return (
    <section className="flex flex-col gap-4">
      {apiNotice ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {apiNotice}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4">
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-white px-3 py-2">
            <p className="text-xs text-zinc-600">
              접속 계정: <span className="font-medium text-zinc-900">{currentAccount?.email || '전체 계정'}</span>
              {currentAccount ? (
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${
                    currentAccount.account_scope === 'personal'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-zinc-100 text-zinc-700'
                  }`}
                >
                  {currentAccount.account_scope === 'personal' ? '개인' : '법인'}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2">
            <label className="inline-flex items-center gap-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                checked={isAllCurrentPageSelected}
                onChange={handleToggleSelectAllCurrentPage}
                className="h-4 w-4 rounded border-zinc-300"
              />
            </label>
            <span className="text-xs text-zinc-500">선택 {selectedMessageCount}건</span>
            <div className="flex items-center gap-1 text-xs text-zinc-600">
              <span>필터:</span>
              <select
                className="h-7 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-700"
                value={readFilter}
                onChange={(e) => handleChangeReadFilter(e.target.value as '' | 'read' | 'unread')}
              >
                <option value="">전체</option>
                <option value="read">읽음</option>
                <option value="unread">안읽음</option>
              </select>
            </div>
            {includeTrash ? (
              <>
                <button
                  type="button"
                  disabled={selectedMessageCount === 0}
                  onClick={() => void handleBulkRestore()}
                  className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  복구
                </button>
                <button
                  type="button"
                  disabled={selectedMessageCount === 0}
                  onClick={() => void handleBulkPurge()}
                  className="rounded border border-rose-300 bg-white px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  완전삭제
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1">
                  <select
                    value={bulkMoveFolderId}
                    onChange={(e) => setBulkMoveFolderId(e.target.value)}
                    disabled={selectedMessageCount === 0 || isMultiAccountSelection || !bulkMoveTargetAccountId}
                    className="h-7 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-700 disabled:opacity-50"
                  >
                    {isMultiAccountSelection ? (
                      <option value="">다중 계정 선택됨</option>
                    ) : !bulkMoveTargetAccountId ? (
                      <option value="">계정 선택 필요</option>
                    ) : (
                      <option value="">폴더 선택</option>
                    )}
                    <option value="inbox">받은메일함(INBOX)</option>
                    {bulkMoveFolders.map((folder) => (
                      <option key={folder.id} value={String(folder.id)}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={selectedMessageCount === 0 || !bulkMoveFolderId.trim() || isMultiAccountSelection || !bulkMoveTargetAccountId}
                    onClick={() => void handleBulkMoveToFolder()}
                    className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    이동
                  </button>
                </div>
                <button
                  type="button"
                  disabled={selectedMessageCount === 0}
                  onClick={() => void handleBulkMoveToTrash()}
                  className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  휴지통 이동
                </button>
                <button
                  type="button"
                  disabled={selectedMessageCount === 0}
                  onClick={() => void handleBulkUpdateRead(true)}
                  className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  읽음
                </button>
                <button
                  type="button"
                  disabled={bulkReadAllLoading || readFilter === 'read'}
                  onClick={() => void handleMarkAllUnreadAsRead()}
                  className="rounded border border-sky-300 bg-white px-2.5 py-1 text-xs text-sky-700 hover:bg-sky-50 disabled:opacity-50"
                >
                  {bulkReadAllLoading ? '전체 읽음 처리중' : '전체 읽음'}
                </button>
                <button
                  type="button"
                  disabled={selectedMessageCount === 0}
                  onClick={() => void handleBulkUpdateRead(false)}
                  className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  안읽음
                </button>
                <button
                  type="button"
                  onClick={() => void handleManualSync()}
                  disabled={manualSyncLoading || typeof mailAccountId !== 'number'}
                  title={typeof mailAccountId === 'number' ? '현재 계정 메일 동기화' : '계정을 선택해 주세요'}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${manualSyncLoading ? 'animate-spin' : ''}`} />
                </button>
              </>
            )}
          </div>
          <table className="w-full table-fixed text-sm">
            <tbody className="divide-y divide-zinc-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-zinc-500">조회 중...</td>
                </tr>
              ) : messages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-zinc-500">메일이 없습니다.</td>
                </tr>
              ) : (
                messages.map((message) => (
                  <tr
                    key={message.id}
                    className="cursor-pointer hover:bg-zinc-50"
                    onClick={() => {
                      router.push(detailQueryString ? `${pathname}/${message.id}?${detailQueryString}` : `${pathname}/${message.id}`)
                    }}
                  >
                    <td className="w-10 px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedMessageIds.includes(message.id)}
                        onChange={() => handleToggleSelectMessage(message.id)}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                    </td>
                    <td className="w-10 px-2 py-3 text-center">
                      {message.is_read ? (
                        <MailOpen className="mx-auto h-4 w-4 text-zinc-500" />
                      ) : (
                        <Mail className="mx-auto h-4 w-4 text-zinc-800" />
                      )}
                    </td>
                    <td className="w-56 px-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-zinc-800">{message.from_name || '-'}</p>
                        <p className="truncate text-[11px] text-zinc-500">{message.from_email || '-'}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-zinc-900">
                      <div className="flex items-center gap-2">
                        {!message.is_read ? <span className="h-2 w-2 rounded-full bg-sky-500" /> : null}
                        <p className={`truncate ${message.is_read ? 'font-normal' : 'font-semibold'}`}>{message.subject || '(제목 없음)'}</p>
                        {message.has_attachment ? <Paperclip className="h-3.5 w-3.5 shrink-0 text-zinc-500" /> : null}
                      </div>
                      <p className="mt-1 w-[92%] truncate pr-4 text-xs text-zinc-500">
                        {resolveMailSnippet({
                          snippetText: message.snippet_text,
                          snippet: message.snippet,
                          bodyText: message.body_text,
                          bodyHtml: message.body_html_rendered || message.body_html,
                        })}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-500">폴더: {message.folder_name || '-'}</p>
                    </td>
                    <td className="w-40 whitespace-nowrap px-3 py-3 text-right text-xs text-zinc-500">
                      {formatKSTDateTimeMinute(message.received_at || message.sent_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="grid grid-cols-1 items-center gap-2 border-t border-zinc-200 px-3 py-3 md:grid-cols-[1fr_auto_1fr]">
            <p className="text-xs text-zinc-500">
              총 {total.toLocaleString('ko-KR')}건 · 현재 {currentStart}-{currentEnd}
            </p>
            <div className="flex items-center justify-center gap-2">
              <UiButton
                disabled={pageGroupStart <= 1}
                onClick={() => setPage(Math.max(1, pageGroupStart - PAGE_GROUP_SIZE))}
                variant="secondary"
                size="sm"
                className="min-w-8 px-2"
              >
                &laquo;
              </UiButton>
              <UiButton
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                variant="secondary"
                size="sm"
                className="min-w-8 px-2"
              >
                &lt;
              </UiButton>
              {visiblePages.map((pageNumber) => (
                <UiButton
                  key={pageNumber}
                  onClick={() => setPage(pageNumber)}
                  variant={pageNumber === page ? 'primary' : 'secondary'}
                  size="sm"
                  className="min-w-8 px-2.5"
                >
                  {pageNumber}
                </UiButton>
              ))}
              <UiButton
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                variant="secondary"
                size="sm"
                className="min-w-8 px-2"
              >
                &gt;
              </UiButton>
              <UiButton
                disabled={pageGroupEnd >= totalPages}
                onClick={() => setPage(Math.min(totalPages, pageGroupStart + PAGE_GROUP_SIZE))}
                variant="secondary"
                size="sm"
                className="min-w-8 px-2"
              >
                &raquo;
              </UiButton>
            </div>
            <div aria-hidden="true" />
          </div>
        </div>

        <div className="hidden space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">메일 상세</h2>
            <p className="mt-1 text-xs text-zinc-500">메일 클릭 시 본문/첨부/고객사 연결을 확인합니다.</p>
          </div>

          {detailLoading ? (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-500">상세 조회 중...</div>
          ) : !detail ? (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-500">메일을 선택해 주세요.</div>
          ) : (
            <>
              <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm">
                <p><span className="text-zinc-500">제목:</span> <span className="text-zinc-900">{detail.subject || '(제목 없음)'}</span></p>
                <p><span className="text-zinc-500">보낸사람:</span> <span className="text-zinc-900">{detail.from_email || '-'}</span></p>
                <p><span className="text-zinc-500">받는사람:</span> <span className="text-zinc-900">{detail.to_emails.join(', ') || '-'}</span></p>
                <p><span className="text-zinc-500">Reply-To:</span> <span className="text-zinc-900">{detail.reply_to_emails.join(', ') || '-'}</span></p>
                <p><span className="text-zinc-500">시각:</span> <span className="text-zinc-900">{formatKSTDateTime(detail.received_at || detail.sent_at)}</span></p>
                <p><span className="text-zinc-500">발송결과:</span> <span className="text-zinc-900">{detail.delivery_status || '-'}</span></p>
                <p><span className="text-zinc-500">Provider ID:</span> <span className="text-zinc-900">{detail.provider_message_id || '-'}</span></p>
                <p><span className="text-zinc-500">In-Reply-To:</span> <span className="text-zinc-900">{detail.in_reply_to_external_message_id || '-'}</span></p>
                <p><span className="text-zinc-500">References:</span> <span className="text-zinc-900">{detail.references_header || '-'}</span></p>
                <p><span className="text-zinc-500">오류:</span> <span className="text-zinc-900">{detail.delivery_error_message || '-'}</span></p>
              </div>

              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-zinc-700">
                    내 상태: <span className="font-medium text-zinc-900">{detail.is_read ? '읽음' : '안읽음'}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleRead}
                      disabled={readUpdating}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {readUpdating ? '처리 중...' : detail.is_read ? '안읽음 처리' : '읽음 처리'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleOpenReply('reply')}
                      disabled={replyLoading}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {replyLoading && replyMode === 'reply' ? '준비 중...' : '답장'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleOpenReply('reply_all')}
                      disabled={replyLoading}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {replyLoading && replyMode === 'reply_all' ? '준비 중...' : '전체답장'}
                    </button>
                    <button
                      type="button"
                      onClick={handleRegisterSpam}
                      className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50"
                    >
                      스팸 등록
                    </button>
                    {detail.is_deleted ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleRestoreMessage(detail.id)}
                          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                        >
                          복구
                        </button>
                        <button
                          type="button"
                          onClick={() => void handlePurgeMessage(detail.id)}
                          className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50"
                        >
                          완전삭제
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleTrashMessage(detail.id)}
                        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                      >
                        휴지통 이동
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleReprocess}
                      disabled={reprocessing}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {reprocessing ? '재처리 중...' : '규칙 재처리'}
                    </button>
                    <button
                      type="button"
                      onClick={handleLoadCandidates}
                      disabled={candidateLoading}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {candidateLoading ? '조회 중...' : '고객사 후보'}
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  직원 읽음 {detail.read_admin_count ?? 0}명 / 미읽음 {detail.unread_admin_count ?? 0}명
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  읽은 직원: {(detail.read_admins || []).map((item) => item.name).join(', ') || '-'}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  미읽은 직원: {(detail.unread_admins || []).map((item) => item.name).join(', ') || '-'}
                </p>
                {candidates.length > 0 ? (
                  <div className="mt-2 rounded-md border border-zinc-200 bg-white px-2 py-2">
                    <p className="text-[11px] text-zinc-500">후보 추천</p>
                    <div className="mt-1 space-y-1">
                      {candidates.map((item) => (
                        <p key={item.company_id} className="text-xs text-zinc-700">
                          #{item.company_id} {item.company_name} · 점수 {item.score}
                          {item.already_linked ? ' · 이미연결' : ''}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {replyDraft ? (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-900">
                      {replyMode === 'reply' ? '답장 작성' : '전체답장 작성'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setReplyDraft(null)}
                      className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50"
                    >
                      닫기
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-zinc-600">기본 받는사람: {replyDraft.to_emails.join(', ') || '-'}</p>
                    <p className="text-xs text-zinc-600">기본 참조: {replyDraft.cc_emails.join(', ') || '-'}</p>
                    <input
                      className={inputClass}
                      value={replyToRaw}
                      onChange={(e) => setReplyToRaw(e.target.value)}
                      placeholder="추가 받는사람 (콤마 구분)"
                    />
                    <input
                      className={inputClass}
                      value={replyCcRaw}
                      onChange={(e) => setReplyCcRaw(e.target.value)}
                      placeholder="추가 참조 (콤마 구분)"
                    />
                    <input
                      className={inputClass}
                      value={replyBccRaw}
                      onChange={(e) => setReplyBccRaw(e.target.value)}
                      placeholder="추가 숨은참조 (콤마 구분)"
                    />
                    <input
                      className={inputClass}
                      value={replyCompanyId}
                      onChange={(e) => setReplyCompanyId(e.target.value)}
                      placeholder="고객사 ID (선택)"
                    />
                    <input
                      className={inputClass}
                      value={replySubject}
                      onChange={(e) => setReplySubject(e.target.value)}
                      placeholder="제목"
                    />
                    <textarea
                      rows={8}
                      value={replyBodyText}
                      onChange={(e) => setReplyBodyText(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                      placeholder="답장 본문"
                    />
                    <label className="flex items-center gap-2 text-xs text-zinc-600">
                      <input type="checkbox" checked={replyQueueOnFail} onChange={(e) => setReplyQueueOnFail(e.target.checked)} />
                      발송 실패 시 자동 큐 등록
                    </label>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleSendReply}
                        disabled={replySending}
                        className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                      >
                        {replySending ? '발송 중...' : '답장 발송'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-md border border-zinc-200">
                <div className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">본문</div>
                <div className="max-h-64 overflow-auto px-3 py-3 text-sm text-zinc-800">
                  {detail.body_html_rendered || detail.body_html ? (
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderedMail.sanitizedHtml }} />
                  ) : (
                    <pre className="whitespace-pre-wrap break-words font-sans">{detail.body_text || '-'}</pre>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3">
                <label className="mb-1 block text-xs text-zinc-500">고객사 ID 연결</label>
                <div className="flex items-center gap-2">
                  <input
                    className={inputClass}
                    value={linkCompanyId}
                    onChange={(e) => setLinkCompanyId(e.target.value)}
                    placeholder="예: 168"
                  />
                  <button
                    type="button"
                    onClick={handleLinkCompany}
                    className="h-10 shrink-0 rounded-md border border-zinc-300 px-3 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    연결
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(detail.links || []).filter((link) => link.company_id).map((link) => (
                    <button
                      key={link.id}
                      type="button"
                      onClick={() => handleUnlinkCompany(link.company_id as number)}
                      className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50"
                    >
                      회사 #{link.company_id} 해제
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-zinc-200">
                <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">첨부파일</span>
                    <label className="inline-flex items-center gap-1 text-[11px] text-zinc-600">
                      <input
                        type="checkbox"
                        checked={includeInlineAttachments}
                        onChange={(e) => setIncludeInlineAttachments(e.target.checked)}
                      />
                      인라인 포함
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={selectedAttachmentCount === 0}
                    onClick={handleImportAttachments}
                    className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    선택 import ({selectedAttachmentCount})
                  </button>
                </div>
                <div className="max-h-56 overflow-auto px-3 py-2">
                  {renderedMail.visibleAttachments.length === 0 ? (
                    <p className="py-4 text-center text-sm text-zinc-500">첨부파일이 없습니다.</p>
                  ) : (
                    <div className="space-y-2">
                      {renderedMail.visibleAttachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-2 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-zinc-900">{attachment.original_file_name}</p>
                            <p className="mt-0.5 text-zinc-500">
                              {attachment.download_status}
                              {attachment.scan_status ? ` · 검사:${attachment.scan_status}` : ''}
                              {attachment.mime_type ? ` · ${attachment.mime_type}` : ''}
                              {attachment.file_size ? ` · ${attachment.file_size.toLocaleString()} bytes` : ''}
                            </p>
                            {attachment.scan_result ? <p className="mt-0.5 text-[11px] text-zinc-500">{attachment.scan_result}</p> : null}
                            {attachment.scanned_at ? <p className="mt-0.5 text-[11px] text-zinc-500">검사시각: {formatKSTDateTime(attachment.scanned_at)}</p> : null}
                            <div className="mt-2 flex items-center gap-2">
                              {attachment.download_status !== 'downloaded' ? (
                                <button
                                  type="button"
                                  onClick={() => void handleImportSingleAttachment(attachment.id)}
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
                          <input
                            type="checkbox"
                            checked={selectedAttachmentIds.includes(attachment.id)}
                            onChange={() => handleToggleAttachment(attachment.id)}
                            className="h-4 w-4 rounded border-zinc-300"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
