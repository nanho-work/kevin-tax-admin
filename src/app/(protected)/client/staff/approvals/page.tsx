import { redirect } from 'next/navigation'

export default function ClientStaffApprovalsPage() {
  redirect('/client/staff/approvals/documents?tab=leave')
}
