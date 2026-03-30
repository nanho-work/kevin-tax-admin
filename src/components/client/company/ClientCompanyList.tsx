'use client'

import CompanyList from '@/components/admin/Company/CompanyList'
import { deactivateClientCompany, fetchClientCompanyTaxList } from '@/services/client/company'

export default function ClientCompanyList() {
  return (
    <CompanyList
      detailBasePath="/client/companies"
      fetchList={fetchClientCompanyTaxList}
      deactivate={deactivateClientCompany}
      disableDelete={false}
      pageSize={12}
      createHref="/client/companies/new"
      createActions={[
        { href: '/client/companies/new', label: '고객사 단건등록' },
        { href: '/client/companies/bulk', label: '고객사 일괄등록' },
      ]}
      showAccountStatus={false}
    />
  )
}
