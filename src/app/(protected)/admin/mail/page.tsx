import { redirect } from 'next/navigation'

export default function AdminMailRootPage() {
  redirect('/admin/mail/inbox')
}
