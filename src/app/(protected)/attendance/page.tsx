import { redirect } from 'next/navigation'

export default function LegacyAttendancePage() {
  redirect('/admin/staff/attendance')
}
