'use client'

import CompanyDetailForm from '@/components/admin/Company/CompanyDetailForm'
import { createCompany } from '@/services/admin/company'
import type { CompanyDetailResponse } from '@/types/admin_campany'

export default function NewCompanyPage() {
  const emptyCompany: CompanyDetailResponse = {
    id: 0,
    company_name: '',
    owner_name: '',
    registration_number: '',
    category: '',
    industry_type: '',
    business_type: '',
    postal_code: '',
    address1: '',
    address2: '',
    is_active: true,
    created_at: '',
    updated_at: '',
  }

  return (
    <div className="min-w-0 overflow-x-auto">
      <CompanyDetailForm
        company={emptyCompany}
        mode="create"
        listPath="/admin/companies"
        createFn={createCompany}
        editable
        showHometaxLogsSection={false}
        enableCustomDocuments={false}
      />
    </div>
  )
}
