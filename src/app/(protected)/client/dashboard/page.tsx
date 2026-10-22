'use client'
import Link from 'next/link'
import { useClientSessionContext } from '@/contexts/ClientSessionContext'
import { getClientRoleRank } from '@/utils/roleRank'
export default function PlatformDashboard() {
  const { session } = useClientSessionContext()
  const isMaster = getClientRoleRank(session) === 0
  return <section className="mx-auto max-w-5xl space-y-6">
    <div><h1 className="text-2xl font-semibold">{isMaster ? '플랫폼 관리' : '사무소 업무 안내'}</h1>
    <p className="mt-2 text-sm text-slate-500">사무소 업무와 직원 관리는 직원 포털의 사무소 관리자 계정으로 이용합니다.</p></div>
    {isMaster && <div className="grid gap-4 sm:grid-cols-2">{[
      ['가입 업체', '/client/client-management/company-list'],
      ['업체 관리자 계정', '/client/client-management/list'],
      ['공통 양식', '/client/client-management/templates'],
      ['동의약관', '/client/client-management/consent-terms'],
      ['메일 운영', '/client/client-management/mail-ops-dashboard'],
      ['로그·보안', '/client/setting/security'],
      ['GPT', '/client/client-management/gpt'],
    ].map(([label, href]) => <Link className="rounded-xl border border-slate-200 bg-white p-5 hover:bg-slate-50" key={href} href={href}>{label}</Link>)}</div>}
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
      <h2 className="font-semibold">사무소 관리로 이동</h2>
      <p className="my-2 text-sm text-slate-600">직원·조직·권한, 근태·연차, 기장·청구·수금, 블로그, 요금제는 사무소 관리에서 확인하세요. 플랫폼 계정과 직원 계정은 별도입니다.</p>
      <Link className="text-sm font-semibold text-blue-700" href="/admin/office/staff">사무소 관리 열기 →</Link>
    </div>
  </section>
}
