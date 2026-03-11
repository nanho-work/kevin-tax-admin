import { redirect } from 'next/navigation'

export default async function LegacyBlogDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  redirect(`/client/client-management/blog/${slug}`)
}
