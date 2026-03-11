import { redirect } from 'next/navigation'

export default function LegacyCompaniesTaxPage() {
  redirect('/admin/tax-schedule')
}
