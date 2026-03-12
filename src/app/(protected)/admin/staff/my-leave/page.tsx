import { redirect } from 'next/navigation'

export default function AdminMyLeaveRedirectPage() {
  redirect('/admin/staff/attendance')
}

