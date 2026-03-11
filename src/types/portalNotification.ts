export type NotificationDomain =
  | 'notice'
  | 'task'
  | 'approval'
  | 'leave'
  | 'mail'
  | 'signup'
  | 'company_docs'

export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical'
export type NotificationReceiptStatus = 'unread' | 'read' | 'ack' | 'in_progress' | 'done'

export interface PortalNotificationItem {
  receipt_id: number
  event_id?: number | null
  domain?: NotificationDomain | string
  action?: string
  priority?: NotificationPriority | string
  title: string
  body?: string | null
  deeplink_url?: string | null
  source_type?: string | null
  source_id?: number | null
  source_snapshot_json?: Record<string, unknown> | null
  status: NotificationReceiptStatus | string
  read_at?: string | null
  created_at: string
}

export interface PortalNotificationListResponse {
  items: PortalNotificationItem[]
  total: number
  page: number
  limit: number
}

export interface PortalNotificationUnreadCountResponse {
  unread_count: number
}
