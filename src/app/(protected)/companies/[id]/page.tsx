import { redirect } from 'next/navigation'

export default async function LegacyCompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/admin/companies/${id}`)
}
