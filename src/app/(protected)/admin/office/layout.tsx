'use client'
import { useAdminSessionContext } from '@/contexts/AdminSessionContext'
import { getAdminRoleRank } from '@/utils/roleRank'
export default function OfficeLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAdminSessionContext()
  if (loading) return <p className="p-6">권한을 확인하고 있습니다.</p>
  if (!session || getAdminRoleRank(session) !== 1) return <p className="p-6">사무소 관리자만 이용할 수 있습니다.</p>
  return <>{children}</>
}
