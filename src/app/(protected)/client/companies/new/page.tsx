'use client'

import CompanyDetailForm from '@/components/admin/Company/CompanyDetailForm'
import { createClientPortalCompany } from '@/services/client/company'
import type { CompanyDetailResponse } from '@/types/admin_campany'

export default function ClientCompanyCreatePage() {
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
    <CompanyDetailForm
      company={emptyCompany}
      mode="create"
      listPath="/client/companies"
      createFn={createClientPortalCompany}
      editable
      showSystemInfo={false}
      enableCustomDocuments={false}
    />
  )
}
