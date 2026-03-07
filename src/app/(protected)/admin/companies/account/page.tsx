'use client'

import { useState } from 'react'
import CompanyAccountCreateForm from '@/components/admin/Company/CompanyAccountCreateForm'
import CompanyAccountList from '@/components/admin/Company/CompanyAccountList'

export default function AdminCompanyAccountPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="min-w-0 space-y-6 overflow-x-auto">
      <CompanyAccountCreateForm
        compact
        hideHeader
        onSuccess={() => {
          setRefreshKey((prev) => prev + 1)
        }}
      />
      <CompanyAccountList refreshKey={refreshKey} hideTitle />
    </div>
  )
}
