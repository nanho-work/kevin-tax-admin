import { redirect } from 'next/navigation'

export default function LegacyCompaniesCreatePage() {
  redirect('/admin/companies/new')
}
