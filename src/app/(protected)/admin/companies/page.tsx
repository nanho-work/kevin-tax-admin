'use client'

import dynamic from 'next/dynamic'
const CompanyList = dynamic(() => import('@/components/admin/Company/CompanyList'), { ssr: false })

export default function AdminCompanyPage() {
  return (
    <div className="min-w-0 overflow-x-auto">
      <CompanyList createHref="/admin/companies/new" createLabel="고객사 등록" />
    </div>
  )
}
