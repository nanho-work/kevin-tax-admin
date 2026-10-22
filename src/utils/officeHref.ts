'use client'
import { usePathname } from 'next/navigation'
export function mapOfficeHref(pathname: string, href: string): string {
  if (!pathname.startsWith('/admin/office')) return href
  return href.replace('/client/client-management/blog', '/admin/office/blog').replace('/client/', '/admin/office/')
}
export function useOfficeHref() {
  const pathname = usePathname()
  return (href: string) => mapOfficeHref(pathname, href)
}
