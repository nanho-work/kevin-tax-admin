'use client'

import dynamic from 'next/dynamic'

const ClientCompanyList = dynamic(() => import('@/components/client/company/ClientCompanyList'), { ssr: false })

export default function ClientCompaniesPage() {
  return (
    <div className="min-w-0 overflow-x-auto">
      <ClientCompanyList />
    </div>
  )
}
