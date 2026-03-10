export type MailProviderType = 'gmail' | 'outlook' | 'naver' | 'gabia' | 'custom'
export type MailAuthType = 'oauth' | 'password' | 'app_password'
export type MailAccountScopeType = 'company' | 'personal'
export type MailDirectionType = 'inbound' | 'outbound'
export type MailRelationType = 'company' | 'contact' | 'internal'
export type MailRuleFieldType = 'from_email' | 'subject' | 'snippet' | 'to_email' | 'cc_email'
export type MailRuleOperatorType = 'contains' | 'equals' | 'starts_with' | 'ends_with'
export type MailLinkStatus = 'linked' | 'unlinked'
export type MailAttachmentDeliveryMode = 'attachment' | 'secure_link'
export type MailboxType = 'all' | 'inbox'

export interface MailAccount {
  id: number
  client_id: number
  company_id: number | null
  account_scope: MailAccountScopeType
  owner_client_account_id: number | null
  owner_admin_id: number | null
  provider_type: MailProviderType
  auth_type: MailAuthType
  email: string
  display_name: string | null
  imap_host: string | null
  imap_port: number | null
  imap_use_ssl: boolean
  smtp_host: string | null
  smtp_port: number | null
  smtp_use_ssl: boolean
  has_password_or_app_secret: boolean
  has_access_token: boolean
  has_refresh_token: boolean
  token_expires_at: string | null
  enc_key_version: string
  sync_enabled: boolean
  sync_interval_minutes?: number
  next_sync_at?: string | null
  consecutive_failures?: number
  backoff_until?: string | null
  last_sync_started_at?: string | null
  last_sync_finished_at?: string | null
  last_sync_uid: string | null
  last_synced_at: string | null
  last_error_code: string | null
  last_error_message: string | null
  initial_sync_status: 'idle' | 'running' | 'completed' | 'failed' | 'canceled'
  initial_sync_started_at?: string | null
  initial_sync_finished_at?: string | null
  initial_sync_target_count?: number | null
  initial_sync_fetched_count: number
  initial_sync_batch_size?: number | null
  initial_sync_cursor_uid?: string | null
  initial_sync_error_message?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MailAccountListResponse {
  total: number
  items: MailAccount[]
}

export interface MailAccountCreatePayload {
  company_id?: number
  account_scope?: MailAccountScopeType
  provider_type: MailProviderType
  auth_type: MailAuthType
  email: string
  display_name?: string
  imap_host?: string
  imap_port?: number
  imap_use_ssl?: boolean
  smtp_host?: string
  smtp_port?: number
  smtp_use_ssl?: boolean
  password_or_app_secret?: string
  access_token?: string
  refresh_token?: string
  token_expires_at?: string
  sync_enabled?: boolean
  sync_interval_minutes?: number
}

export interface MailAccountUpdatePayload {
  company_id?: number | null
  account_scope?: MailAccountScopeType
  provider_type?: MailProviderType
  auth_type?: MailAuthType
  email?: string
  display_name?: string
  imap_host?: string
  imap_port?: number
  imap_use_ssl?: boolean
  smtp_host?: string
  smtp_port?: number
  smtp_use_ssl?: boolean
  password_or_app_secret?: string
  access_token?: string
  refresh_token?: string
  token_expires_at?: string
  sync_enabled?: boolean
  sync_interval_minutes?: number
  is_active?: boolean
}

export interface MailConnectionTestResponse {
  imap_ok: boolean
  smtp_ok: boolean
  detail: string
}

export interface MailSyncResponse {
  message: string
  mail_account_id: number
  sync_log_id: number
  synced_count: number
  status: 'success' | 'partial' | 'failed'
  cursor_before: string | null
  cursor_after: string | null
  error_message: string | null
  rule_hit_message_count?: number
  matched_rule_total?: number
  folder_applied_count?: number
  linked_company_count?: number
}

export interface MailInitialSyncStartPayload {
  target_count: number
  batch_size: number
}

export interface MailInitialSyncStatusResponse {
  message: string
  mail_account_id: number
  initial_sync_status: 'idle' | 'running' | 'completed' | 'failed' | 'canceled'
  initial_sync_started_at?: string | null
  initial_sync_finished_at?: string | null
  initial_sync_target_count?: number | null
  initial_sync_fetched_count: number
  initial_sync_batch_size?: number | null
  initial_sync_cursor_uid?: string | null
  initial_sync_error_message?: string | null
}

export interface MailGoogleOAuthStartPayload {
  account_scope: MailAccountScopeType
  company_id?: number
  sync_enabled?: boolean
  sync_interval_minutes?: number
}

export interface MailGoogleOAuthStartResponse {
  message?: string
  provider?: 'gmail'
  authorize_url: string
  state?: string | null
  state_expires_at?: string
}

export interface MailGoogleOAuthCallbackResponse {
  message: string
  provider?: 'gmail'
  mail_account_id?: number | null
  email?: string
  account_scope?: MailAccountScopeType
  sync_enabled?: boolean
}

export interface MailMessageLink {
  id: number
  client_id: number
  mail_message_id: number
  company_id: number | null
  contact_id: number | null
  employee_id: number | null
  relation_type: MailRelationType
  is_manual: boolean
  created_by_client_account_id: number | null
  created_at: string
}

export interface MailAttachment {
  id: number
  client_id: number
  mail_message_id: number
  original_file_name: string
  stored_file_name: string | null
  mime_type: string | null
  file_size: number | null
  s3_key: string | null
  content_id?: string | null
  cid?: string | null
  content_disposition?: 'inline' | 'attachment' | string | null
  is_inline?: boolean | null
  preview_url?: string | null
  download_url?: string | null
  file_url?: string | null
  url?: string | null
  download_status: 'pending' | 'downloaded' | 'failed'
  scan_status?: 'pending' | 'clean' | 'infected' | 'error' | null
  scan_result?: string | null
  scanned_at?: string | null
  imported_at: string | null
  created_at: string
  updated_at: string
}

export interface MailReadAdmin {
  admin_id: number
  name: string
}

export interface MailMessage {
  id: number
  client_id: number
  mail_account_id: number
  external_message_id: string | null
  external_uid: string
  thread_key: string | null
  direction: MailDirectionType
  folder_name: string | null
  subject: string | null
  from_name: string | null
  from_email: string | null
  to_emails: string[]
  cc_emails: string[]
  bcc_emails: string[]
  reply_to_emails: string[]
  snippet: string | null
  snippet_text?: string | null
  body_text: string | null
  body_html: string | null
  body_html_rendered?: string | null
  has_attachment: boolean
  is_read: boolean
  read_admin_count?: number
  unread_admin_count?: number
  received_at: string | null
  sent_at: string | null
  synced_at: string | null
  delivery_status?: 'sent' | 'failed' | 'partial' | null
  delivery_error_code?: string | null
  delivery_error_message?: string | null
  provider_message_id?: string | null
  in_reply_to_external_message_id?: string | null
  references_header?: string | null
  sent_by_actor_type?: 'client' | 'admin' | 'system' | null
  sent_by_actor_id?: number | null
  attachment_delivery_mode?: MailAttachmentDeliveryMode | null
  is_deleted?: boolean
  deleted_at?: string | null
  created_at: string
  updated_at: string
}

export interface MailMessageDetail extends MailMessage {
  links: MailMessageLink[]
  attachments: MailAttachment[]
  read_admins?: MailReadAdmin[]
  unread_admins?: MailReadAdmin[]
}

export interface MailMessageListResponse {
  total: number
  items: MailMessage[]
}

export interface MailMessageListParams {
  page?: number
  size?: number
  company_id?: number
  mail_account_id?: number
  mailbox_type?: MailboxType
  direction?: MailDirectionType
  folder_name?: string
  link_status?: MailLinkStatus
  has_attachment?: boolean
  is_read?: boolean
  date_from?: string
  date_to?: string
  keyword?: string
  from_email?: string
  include_trash?: boolean
}

export interface MailMessageDeleteResponse {
  message: string
  mail_message_id: number
  is_deleted: boolean
}

export interface MailMessageLinkCompanyPayload {
  company_id: number
  relation_type?: MailRelationType
}

export interface MailMessageUnlinkCompanyPayload {
  company_id: number
  relation_type?: MailRelationType
}

export interface MailMessageMoveFolderPayload {
  folder_id?: number | null
}

export interface MailMessageMoveFolderResponse {
  message: string
  mail_message_id: number
  folder_name?: string | null
}

export interface MailAttachmentListResponse {
  total: number
  items: MailAttachment[]
}

export interface MailAttachmentImportPayload {
  attachment_ids: number[]
}

export interface MailAttachmentImportResponse {
  message: string
  results: Array<{
    attachment_id: number
    status: 'downloaded' | 'skipped' | 'failed'
    detail: string | null
    s3_key: string | null
  }>
}

export interface MailAttachmentSaveToCompanyPayload {
  company_id: number
  attachment_ids: number[]
  auto_import_if_missing?: boolean
}

export interface MailAttachmentSaveToCompanyResponse {
  message: string
  company_id?: number
  attachment_ids?: number[]
  saved_count?: number
}

export interface MailSendPayload {
  mail_account_id: number
  company_id?: number
  to_emails: string[]
  cc_emails?: string[]
  bcc_emails?: string[]
  subject: string
  body_text?: string
  body_html?: string
  attachment_s3_keys?: string[]
  attachment_mode?: MailAttachmentDeliveryMode
  secure_link_expire_days?: number
  secure_link_max_download_count?: number
  queue_on_fail?: boolean
}

export interface MailSendResponse {
  message: string
  mail_message_id?: number | null
  status?: 'sent' | 'queued' | 'failed'
  queue_job_id?: number | null
  attachment_mode?: MailAttachmentDeliveryMode
  secure_link_count?: number
}

export interface MailDraftSavePayload {
  draft_id?: number
  mail_account_id?: number
  company_id?: number
  to_emails?: string[]
  cc_emails?: string[]
  bcc_emails?: string[]
  subject?: string
  body_text?: string
  body_html?: string
  attachment_s3_keys?: string[]
}

export interface MailDraft {
  id: number
  client_id: number
  mail_account_id?: number | null
  company_id?: number | null
  actor_type: 'client' | 'admin'
  actor_id: number
  to_emails: string[]
  cc_emails: string[]
  bcc_emails: string[]
  subject?: string | null
  body_text?: string | null
  body_html?: string | null
  attachment_s3_keys: string[]
  status: 'draft' | 'scheduled_delete'
  expires_at: string
  created_at: string
  updated_at: string
}

export interface MailDraftListResponse {
  total: number
  items: MailDraft[]
}

export interface MailDraftDeleteResponse {
  message: string
  draft_id: number
}

export interface MailReplyDraftResponse {
  source_message_id: number
  mail_account_id: number
  mode: 'reply' | 'reply_all'
  subject: string
  to_emails: string[]
  cc_emails: string[]
  in_reply_to_external_message_id?: string | null
  references_header?: string | null
}

export interface MailReplySendPayload {
  mode?: 'reply' | 'reply_all'
  company_id?: number
  subject?: string
  body_text?: string
  body_html?: string
  additional_to_emails?: string[]
  additional_cc_emails?: string[]
  additional_bcc_emails?: string[]
  attachment_s3_keys?: string[]
  attachment_mode?: MailAttachmentDeliveryMode
  secure_link_expire_days?: number
  secure_link_max_download_count?: number
  queue_on_fail?: boolean
}

export interface MailForwardDraftResponse {
  source_message_id: number
  mail_account_id: number
  subject: string
  to_emails?: string[]
  cc_emails?: string[]
  bcc_emails?: string[]
  attachment_s3_keys?: string[]
  available_attachment_s3_keys?: string[]
}

export interface MailForwardSendPayload {
  company_id?: number
  subject?: string
  body_text?: string
  body_html?: string
  to_emails?: string[]
  cc_emails?: string[]
  bcc_emails?: string[]
  include_original_body?: boolean
  include_original_attachments?: boolean
  attachment_s3_keys?: string[]
  attachment_mode?: MailAttachmentDeliveryMode
  secure_link_expire_days?: number
  secure_link_max_download_count?: number
  queue_on_fail?: boolean
}

export interface MailReadUpdatePayload {
  is_read: boolean
}

export interface MailReadUpdateResponse {
  message: string
  mail_message_id: number
  is_read: boolean
}

export interface MailCompanyCandidate {
  company_id: number
  company_name: string
  registration_number?: string | null
  score: number
  reasons: string[]
  already_linked: boolean
  matched_email?: string | null
}

export interface MailCompanyCandidateListResponse {
  total: number
  items: MailCompanyCandidate[]
}

export interface MailSyncLog {
  id: number
  client_id: number
  mail_account_id: number
  sync_type: string
  status: string
  cursor_before?: string | null
  cursor_after?: string | null
  synced_count: number
  retry_count: number
  error_message?: string | null
  started_at: string
  ended_at?: string | null
  created_at: string
}

export interface MailSyncLogListResponse {
  total: number
  items: MailSyncLog[]
}

export interface MailActionLog {
  id: number
  client_id: number
  mail_account_id?: number | null
  mail_message_id?: number | null
  action: string
  actor_type: string
  actor_client_account_id?: number | null
  actor_admin_id?: number | null
  detail?: string | null
  created_at: string
}

export interface MailActionLogListResponse {
  total: number
  items: MailActionLog[]
}

export interface MailReprocessResponse {
  message: string
  processed_count: number
  rule_hit_message_count: number
  matched_rule_total: number
  folder_applied_count: number
  linked_company_count: number
}

export interface MailSendJobFailure {
  id: number
  client_id: number
  mail_account_id: number
  status: string
  is_retryable: boolean
  retry_count: number
  max_retry: number
  next_retry_at?: string | null
  stopped_reason?: string | null
  last_error_code?: string | null
  last_error_message?: string | null
  updated_at: string
}

export interface MailOpsDashboardResponse {
  total_active_accounts: number
  sync_due_accounts: number
  sync_backoff_accounts: number
  queue_waiting_count: number
  queue_processing_count: number
  queue_failed_count: number
  queue_sent_today_count: number
  recent_sync_failures: MailSyncLog[]
  recent_send_failures: MailSendJobFailure[]
}

export interface MailFolder {
  id: number
  client_id: number
  mail_account_id?: number | null
  name: string
  color?: string | null
  description?: string | null
  sort_order: number
  is_active: boolean
  created_by_client_account_id?: number | null
  created_at: string
  updated_at: string
}

export interface MailFolderListResponse {
  total: number
  items: MailFolder[]
}

export interface MailFolderCreatePayload {
  name: string
  color?: string
  description?: string
  sort_order?: number
  mail_account_id?: number
}

export interface MailFolderUpdatePayload {
  name?: string
  color?: string
  description?: string
  sort_order?: number
  is_active?: boolean
}

export interface MailRule {
  id: number
  client_id: number
  name: string
  mail_account_id?: number | null
  priority: number
  is_active: boolean
  match_field: MailRuleFieldType
  match_operator: MailRuleOperatorType
  match_value: string
  target_folder_id?: number | null
  target_company_id?: number | null
  stop_processing: boolean
  created_by_client_account_id?: number | null
  created_at: string
  updated_at: string
}

export interface MailRuleListResponse {
  total: number
  items: MailRule[]
}

export interface MailRuleCreatePayload {
  name: string
  mail_account_id?: number
  priority?: number
  is_active?: boolean
  match_field?: MailRuleFieldType
  match_operator?: MailRuleOperatorType
  match_value: string
  target_folder_id?: number
  target_company_id?: number
  stop_processing?: boolean
}

export interface MailRuleUpdatePayload {
  name?: string
  mail_account_id?: number
  priority?: number
  is_active?: boolean
  match_field?: MailRuleFieldType
  match_operator?: MailRuleOperatorType
  match_value?: string
  target_folder_id?: number
  target_company_id?: number
  stop_processing?: boolean
}
