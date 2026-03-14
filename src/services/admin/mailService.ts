import axios from 'axios'
import { adminHttp } from '@/services/http'
import type {
  MailActionLogListResponse,
  MailAccount,
  MailAccountCreatePayload,
  MailAccountListResponse,
  MailAccountUpdatePayload,
  MailAttachmentImportPayload,
  MailAttachmentImportResponse,
  MailComposeAttachmentUploadResponse,
  MailAttachmentSaveToCompanyPayload,
  MailAttachmentSaveToCompanyResponse,
  MailAttachmentListResponse,
  MailCompanyCandidateListResponse,
  MailConnectionTestResponse,
  MailDraft,
  MailDraftDeleteResponse,
  MailDraftListResponse,
  MailDraftSavePayload,
  MailFolder,
  MailFolderCreatePayload,
  MailFolderListResponse,
  MailFolderUpdatePayload,
  MailForwardDraftResponse,
  MailForwardSendPayload,
  MailGoogleOAuthCallbackResponse,
  MailGoogleOAuthStartPayload,
  MailGoogleOAuthStartResponse,
  MailInitialSyncStartPayload,
  MailInitialSyncStatusResponse,
  MailMessageDetail,
  MailMessageDeleteResponse,
  MailMessageBulkMoveFolderPayload,
  MailMessageBulkMoveFolderResponse,
  MailMessageMoveFolderPayload,
  MailMessageMoveFolderResponse,
  MailMessageLinkCompanyPayload,
  MailMessageListParams,
  MailMessageListResponse,
  MailMessageUnlinkCompanyPayload,
  MailOpsDashboardResponse,
  MailReplyDraftResponse,
  MailReplySendPayload,
  MailReadUpdateResponse,
  MailReprocessResponse,
  MailRule,
  MailRuleCreatePayload,
  MailRuleListResponse,
  MailRuleUpdatePayload,
  MailSendPayload,
  MailSendResponse,
  MailSyncLogListResponse,
  MailSyncResponse,
} from '@/types/adminMail'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/mail`

export function getAdminMailErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const detail = (error.response?.data as any)?.detail
    const normalizedDetail = typeof detail === 'string' ? detail.trim() : ''
    const detailLooksTechnical =
      /traceback|sql|stack|exception|axios|internal server error/i.test(normalizedDetail) ||
      normalizedDetail.length > 160

    if (status === 400) {
      if (normalizedDetail && !detailLooksTechnical) return normalizedDetail
      return '요청값을 다시 확인해 주세요.'
    }
    if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
    if (status === 403) return '권한이 없어 요청을 처리할 수 없습니다.'
    if (status === 404) return '요청한 메일 정보를 찾을 수 없습니다.'
    if (status === 409) return '현재 상태에서는 이 작업을 진행할 수 없습니다.'
    if (status === 422) {
      if (normalizedDetail && !detailLooksTechnical) return normalizedDetail
      return '입력값을 확인해 주세요.'
    }
    if (typeof status === 'number' && status >= 500) {
      return '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
    }

    if (normalizedDetail && !detailLooksTechnical) return normalizedDetail
    return '메일 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  }
  return '메일 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'
}

export async function createMailAccount(payload: MailAccountCreatePayload): Promise<MailAccount> {
  const res = await adminHttp.post<MailAccount>(`${BASE}/accounts`, payload)
  return res.data
}

export async function listMailAccounts(
  isActive?: boolean,
  accountScope?: 'company' | 'personal'
): Promise<MailAccountListResponse> {
  const res = await adminHttp.get<MailAccountListResponse>(`${BASE}/accounts`, {
    params: {
      is_active: typeof isActive === 'boolean' ? isActive : undefined,
      account_scope: accountScope,
    },
  })
  return res.data
}

export async function updateMailAccount(mailAccountId: number, payload: MailAccountUpdatePayload): Promise<MailAccount> {
  const res = await adminHttp.patch<MailAccount>(`${BASE}/accounts/${mailAccountId}`, payload)
  return res.data
}

export async function deleteMailAccount(mailAccountId: number): Promise<{ message: string }> {
  const res = await adminHttp.delete<{ message: string }>(`${BASE}/accounts/${mailAccountId}`)
  return res.data
}

export async function testMailAccountConnection(mailAccountId: number): Promise<MailConnectionTestResponse> {
  const res = await adminHttp.post<MailConnectionTestResponse>(
    `${BASE}/accounts/${mailAccountId}/test-connection`,
    {}
  )
  return res.data
}

export async function syncMailAccount(mailAccountId: number, fetchLimit = 50): Promise<MailSyncResponse> {
  const res = await adminHttp.post<MailSyncResponse>(
    `${BASE}/accounts/${mailAccountId}/sync`,
    {},
    {
      params: { fetch_limit: fetchLimit },
    }
  )
  return res.data
}

export async function startMailAccountInitialSync(
  mailAccountId: number,
  payload: MailInitialSyncStartPayload
): Promise<MailInitialSyncStatusResponse> {
  const res = await adminHttp.post<MailInitialSyncStatusResponse>(
    `${BASE}/accounts/${mailAccountId}/initial-sync/start`,
    payload
  )
  return res.data
}

export async function getMailAccountInitialSyncStatus(mailAccountId: number): Promise<MailInitialSyncStatusResponse> {
  const res = await adminHttp.get<MailInitialSyncStatusResponse>(`${BASE}/accounts/${mailAccountId}/initial-sync/status`)
  return res.data
}

export async function cancelMailAccountInitialSync(mailAccountId: number): Promise<MailInitialSyncStatusResponse> {
  const res = await adminHttp.post<MailInitialSyncStatusResponse>(`${BASE}/accounts/${mailAccountId}/initial-sync/cancel`, {})
  return res.data
}

export async function startGoogleOAuth(
  payload: MailGoogleOAuthStartPayload
): Promise<MailGoogleOAuthStartResponse> {
  const res = await adminHttp.post<MailGoogleOAuthStartResponse>(`${BASE}/oauth/google/start`, payload)
  return res.data
}

export async function completeGoogleOAuth(
  code: string,
  state: string
): Promise<MailGoogleOAuthCallbackResponse> {
  const res = await adminHttp.get<MailGoogleOAuthCallbackResponse>(`${BASE}/oauth/google/callback`, {
    params: { code, state },
  })
  return res.data
}

export async function listMailMessages(params: MailMessageListParams): Promise<MailMessageListResponse> {
  const res = await adminHttp.get<MailMessageListResponse>(`${BASE}/messages`, {
    params: {
      page: params.page ?? 1,
      size: params.size ?? 20,
      company_id: params.company_id,
      mail_account_id: params.mail_account_id,
      mailbox_type: params.mailbox_type,
      direction: params.direction,
      folder_name: params.folder_name,
      link_status: params.link_status,
      has_attachment: params.has_attachment,
      is_read: params.is_read,
      date_from: params.date_from,
      date_to: params.date_to,
      keyword: params.keyword,
      from_email: params.from_email,
      include_trash: params.include_trash,
    },
  })
  return res.data
}

export async function getMailMessageDetail(messageId: number, mailAccountId?: number): Promise<MailMessageDetail> {
  void mailAccountId
  const res = await adminHttp.get<MailMessageDetail>(`${BASE}/messages/${messageId}`)
  return res.data
}

export async function moveMailMessageToTrash(messageId: number, mailAccountId?: number): Promise<MailMessageDeleteResponse> {
  void mailAccountId
  const res = await adminHttp.post<MailMessageDeleteResponse>(`${BASE}/messages/${messageId}/trash`, {})
  return res.data
}

export async function restoreMailMessageFromTrash(messageId: number, mailAccountId?: number): Promise<MailMessageDeleteResponse> {
  void mailAccountId
  const res = await adminHttp.post<MailMessageDeleteResponse>(`${BASE}/messages/${messageId}/restore`, {})
  return res.data
}

export async function purgeMailMessage(messageId: number, mailAccountId?: number): Promise<MailMessageDeleteResponse> {
  void mailAccountId
  const res = await adminHttp.delete<MailMessageDeleteResponse>(`${BASE}/messages/${messageId}/purge`)
  return res.data
}

export async function moveMailMessageToFolder(
  messageId: number,
  payload: MailMessageMoveFolderPayload,
  mailAccountId?: number
): Promise<MailMessageMoveFolderResponse> {
  void mailAccountId
  const res = await adminHttp.post<MailMessageMoveFolderResponse>(`${BASE}/messages/${messageId}/move-folder`, payload)
  return res.data
}

export async function bulkMoveMailMessagesToFolder(
  payload: MailMessageBulkMoveFolderPayload,
  mailAccountId?: number
): Promise<MailMessageBulkMoveFolderResponse> {
  void mailAccountId
  const res = await adminHttp.post<MailMessageBulkMoveFolderResponse>(`${BASE}/messages/bulk-move-folder`, payload)
  return res.data
}

export async function updateMailMessageRead(
  messageId: number,
  isRead: boolean,
  mailAccountId?: number
): Promise<MailReadUpdateResponse> {
  void mailAccountId
  const res = await adminHttp.patch<MailReadUpdateResponse>(`${BASE}/messages/${messageId}/read`, {
    is_read: isRead,
  })
  return res.data
}

export async function linkMailMessageCompany(messageId: number, payload: MailMessageLinkCompanyPayload): Promise<{ message: string }> {
  const res = await adminHttp.post<{ message: string }>(`${BASE}/messages/${messageId}/link-company`, payload)
  return res.data
}

export async function unlinkMailMessageCompany(messageId: number, payload: MailMessageUnlinkCompanyPayload): Promise<{ message: string }> {
  const res = await adminHttp.post<{ message: string }>(`${BASE}/messages/${messageId}/unlink-company`, payload)
  return res.data
}

export async function listMailAttachments(
  messageId: number,
  includeInline = false,
  mailAccountId?: number
): Promise<MailAttachmentListResponse> {
  void mailAccountId
  const res = await adminHttp.get<MailAttachmentListResponse>(`${BASE}/messages/${messageId}/attachments`, {
    params: {
      include_inline: includeInline,
    },
  })
  return res.data
}

export async function importMailAttachments(
  messageId: number,
  payload: MailAttachmentImportPayload
): Promise<MailAttachmentImportResponse> {
  const res = await adminHttp.post<MailAttachmentImportResponse>(
    `${BASE}/messages/${messageId}/attachments/import`,
    payload
  )
  return res.data
}

export async function saveMailAttachmentsToCompany(
  messageId: number,
  payload: MailAttachmentSaveToCompanyPayload
): Promise<MailAttachmentSaveToCompanyResponse> {
  const res = await adminHttp.post<MailAttachmentSaveToCompanyResponse>(
    `${BASE}/messages/${messageId}/attachments/save-to-company`,
    payload
  )
  return res.data
}

export async function sendMail(payload: MailSendPayload): Promise<MailSendResponse> {
  const res = await adminHttp.post<MailSendResponse>(`${BASE}/send`, payload)
  return res.data
}

export async function uploadMailComposeAttachment(file: File): Promise<MailComposeAttachmentUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await adminHttp.post<MailComposeAttachmentUploadResponse>(`${BASE}/compose/attachments`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return res.data
}

export async function listMailDrafts(page = 1, size = 20): Promise<MailDraftListResponse> {
  const res = await adminHttp.get<MailDraftListResponse>(`${BASE}/drafts`, {
    params: { page, size },
  })
  return res.data
}

export async function saveMailDraft(payload: MailDraftSavePayload): Promise<MailDraft> {
  const res = await adminHttp.post<MailDraft>(`${BASE}/drafts`, payload)
  return res.data
}

export async function getMailDraftDetail(draftId: number): Promise<MailDraft> {
  const res = await adminHttp.get<MailDraft>(`${BASE}/drafts/${draftId}`)
  return res.data
}

export async function deleteMailDraft(draftId: number): Promise<MailDraftDeleteResponse> {
  const res = await adminHttp.delete<MailDraftDeleteResponse>(`${BASE}/drafts/${draftId}`)
  return res.data
}

export async function listMailFolders(isActive = true, mailAccountId?: number): Promise<MailFolderListResponse> {
  const res = await adminHttp.get<MailFolderListResponse>(`${BASE}/folders`, {
    params: {
      is_active: isActive,
      mail_account_id: mailAccountId,
    },
  })
  return res.data
}

export async function createMailFolder(payload: MailFolderCreatePayload): Promise<MailFolder> {
  const res = await adminHttp.post<MailFolder>(`${BASE}/folders`, payload)
  return res.data
}

export async function updateMailFolder(folderId: number, payload: MailFolderUpdatePayload): Promise<MailFolder> {
  const res = await adminHttp.patch<MailFolder>(`${BASE}/folders/${folderId}`, payload)
  return res.data
}

export async function deleteMailFolder(folderId: number): Promise<{ message: string }> {
  const res = await adminHttp.delete<{ message: string }>(`${BASE}/folders/${folderId}`)
  return res.data
}

export async function listMailRules(params?: { is_active?: boolean; mail_account_id?: number }): Promise<MailRuleListResponse> {
  const res = await adminHttp.get<MailRuleListResponse>(`${BASE}/rules`, {
    params: {
      is_active: params?.is_active ?? true,
      mail_account_id: params?.mail_account_id,
    },
  })
  return res.data
}

export async function createMailRule(payload: MailRuleCreatePayload): Promise<MailRule> {
  const res = await adminHttp.post<MailRule>(`${BASE}/rules`, payload)
  return res.data
}

export async function updateMailRule(ruleId: number, payload: MailRuleUpdatePayload): Promise<MailRule> {
  const res = await adminHttp.patch<MailRule>(`${BASE}/rules/${ruleId}`, payload)
  return res.data
}

export async function deleteMailRule(ruleId: number): Promise<{ message: string }> {
  const res = await adminHttp.delete<{ message: string }>(`${BASE}/rules/${ruleId}`)
  return res.data
}

export async function reprocessMailAccountRules(
  mailAccountId: number,
  params?: { limit?: number; only_unlinked?: boolean }
): Promise<MailReprocessResponse> {
  const res = await adminHttp.post<MailReprocessResponse>(`${BASE}/accounts/${mailAccountId}/reprocess-rules`, {}, {
    params: {
      limit: params?.limit,
      only_unlinked: params?.only_unlinked,
    },
  })
  return res.data
}

export async function listMailSyncLogs(params?: {
  page?: number
  size?: number
  mail_account_id?: number
  status?: string
  sync_type?: string
}): Promise<MailSyncLogListResponse> {
  const res = await adminHttp.get<MailSyncLogListResponse>(`${BASE}/sync-logs`, {
    params: {
      page: params?.page ?? 1,
      size: params?.size ?? 20,
      mail_account_id: params?.mail_account_id,
      status: params?.status,
      sync_type: params?.sync_type,
    },
  })
  return res.data
}

export async function listMailActionLogs(params?: {
  page?: number
  size?: number
  action?: string
  actor_type?: string
  mail_account_id?: number
  mail_message_id?: number
}): Promise<MailActionLogListResponse> {
  const res = await adminHttp.get<MailActionLogListResponse>(`${BASE}/action-logs`, {
    params: {
      page: params?.page ?? 1,
      size: params?.size ?? 20,
      action: params?.action,
      actor_type: params?.actor_type,
      mail_account_id: params?.mail_account_id,
      mail_message_id: params?.mail_message_id,
    },
  })
  return res.data
}

export async function getMailOpsDashboard(): Promise<MailOpsDashboardResponse> {
  const res = await adminHttp.get<MailOpsDashboardResponse>(`${BASE}/ops/dashboard`)
  return res.data
}

export async function getMailMessageCompanyCandidates(
  messageId: number,
  limit = 5
): Promise<MailCompanyCandidateListResponse> {
  const res = await adminHttp.get<MailCompanyCandidateListResponse>(`${BASE}/messages/${messageId}/company-candidates`, {
    params: { limit },
  })
  return res.data
}

export async function reprocessMailMessageRules(messageId: number): Promise<MailReprocessResponse> {
  const res = await adminHttp.post<MailReprocessResponse>(`${BASE}/messages/${messageId}/reprocess-rules`, {})
  return res.data
}

export async function getMailReplyDraft(
  messageId: number,
  mode: 'reply' | 'reply_all'
): Promise<MailReplyDraftResponse> {
  const res = await adminHttp.get<MailReplyDraftResponse>(`${BASE}/messages/${messageId}/reply-draft`, {
    params: { mode },
  })
  return res.data
}

export async function sendMailReply(
  messageId: number,
  payload: MailReplySendPayload
): Promise<MailSendResponse> {
  const res = await adminHttp.post<MailSendResponse>(`${BASE}/messages/${messageId}/reply`, payload)
  return res.data
}

export async function getMailForwardDraft(messageId: number): Promise<MailForwardDraftResponse> {
  const res = await adminHttp.get<MailForwardDraftResponse>(`${BASE}/messages/${messageId}/forward-draft`)
  const data = res.data || ({} as MailForwardDraftResponse)
  return {
    ...data,
    attachment_s3_keys:
      data.attachment_s3_keys ??
      data.available_attachment_s3_keys ??
      [],
  }
}

export async function sendMailForward(
  messageId: number,
  payload: MailForwardSendPayload
): Promise<MailSendResponse> {
  const res = await adminHttp.post<MailSendResponse>(`${BASE}/messages/${messageId}/forward`, payload)
  return res.data
}
