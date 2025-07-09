// types/notification.ts
export interface NotificationItem {
  id: number;
  message: string;
  client_name: string;
  due_date: string;
  seen?: boolean;
}