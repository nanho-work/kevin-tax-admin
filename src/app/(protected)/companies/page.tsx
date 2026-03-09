'use client'

import dynamic from 'next/dynamic'
const CompanyList = dynamic(() => import('@/components/Company/CompanyList'), { ssr: false })

export default function AdminCompanyPage() {
  return (
    <div className="min-w-0 overflow-x-auto">
      <CompanyList />
    </div>
  )
}