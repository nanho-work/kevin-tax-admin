'use client'
import { useClientSessionContext } from '@/contexts/ClientSessionContext'
import { getClientRoleRank } from '@/utils/roleRank'
export default function ClientSettingSecurityPage() {
  const { session, loading } = useClientSessionContext()
  if (loading) return <p>권한 확인 중...</p>
  if (getClientRoleRank(session) !== 0) return <p>플랫폼 마스터만 이용할 수 있습니다.</p>
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold text-zinc-900">로그/보안</h2>
      <p className="mt-2 text-sm text-zinc-500">메뉴 구성 완료. 세부 설정 기능은 다음 단계에서 추가합니다.</p>
    </section>
  )
}
