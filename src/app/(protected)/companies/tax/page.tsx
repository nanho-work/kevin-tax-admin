'use client'

import dynamic from 'next/dynamic'

// ssr: false를 설정해 클라이언트에서만 렌더링되게 함
const CompanyTaxDetailReport = dynamic(
  () => import('@/components/Company/CompanyTaxDetailReport'),
  { ssr: false }
)

export default function CompanyTaxPage() {
  return (
    <div className="w-full p-6">
      <CompanyTaxDetailReport />
    </div>
  )
}