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
      createLabel="거래처등록"
      showAccountStatus={false}
    />
  )
}
