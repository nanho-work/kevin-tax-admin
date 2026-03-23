'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import CompanyDetailForm from '@/components/admin/Company/CompanyDetailForm'
import { useClientSessionContext } from '@/contexts/ClientSessionContext'
import { getClientRoleRank } from '@/utils/roleRank'
import {
  COMPANY_DOC_TYPE_BANKBOOK,
  deleteClientCompanyBusinessLicense,
  deleteClientCompanyCustomDocument,
  deleteClientCompanyDocument,
  fetchClientCompanyBusinessLicensePreview,
  fetchClientCompanyDocumentPreview,
  fetchClientCompanyDetail,
  getClientCompanyCustomDocumentDownloadUrl,
  getClientCompanyCustomDocumentPreviewUrl,
  listClientCompanyCustomDocumentLogs,
  listClientHometaxCredentialLogs,
  listClientCompanyCustomDocuments,
  updateClientCompany,
  uploadClientCompanyCustomDocument,
  uploadClientCompanyCustomDocumentsBulk,
  uploadClientCompanyDocument,
  uploadClientCompanyBusinessLicense,
  COMPANY_DOC_TYPE_OWNER_ID,
  COMPANY_DOC_TYPE_BUSINESS_LICENSE,
  getClientHometaxCredential,
  patchClientHometaxCredentialActive,
  revealClientHometaxCredentialPassword,
  type ClientCompanyDocumentPreviewResponse,
  upsertClientHometaxCredential,
} from '@/services/client/company'
import {
  createClientCompanyAccount,
  getClientCompanyAccounts,
  updateClientCompanyAccountStatus,
} from '@/services/client/companyAccountService'
import type { CompanyDetailResponse } from '@/types/admin_campany'

export default function ClientCompanyDetailPage() {
  const params = useParams<{ id: string }>()
  const { session } = useClientSessionContext()
  const companyId = Number(params.id)
  const roleRank = getClientRoleRank(session)
  const canDeleteRequiredDocuments = roleRank === 0
  const canManageHometax = roleRank <= 10
  const [company, setCompany] = useState<CompanyDetailResponse | null>(null)
  const [businessLicensePreview, setBusinessLicensePreview] = useState<ClientCompanyDocumentPreviewResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!companyId) return
    const load = async () => {
      try {
        const [detail, preview] = await Promise.all([
          fetchClientCompanyDetail(companyId),
          fetchClientCompanyBusinessLicensePreview(companyId).catch(() => null),
        ])
        setCompany(detail)
        setBusinessLicensePreview(preview)
      } catch (err) {
        console.error('상세 정보 조회 실패:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [companyId])

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
        회사 정보를 불러오는 중...
      </div>
    )
  }

  if (!company) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-10 text-center text-sm text-rose-700">
        회사 정보를 찾을 수 없습니다.
      </div>
    )
  }

  return (
    <CompanyDetailForm
      company={company}
      editable
      showSystemInfo={false}
      enableCustomDocuments
      listPath="/client/companies"
      businessLicensePreview={businessLicensePreview}
      documentTypes={[
        { code: COMPANY_DOC_TYPE_BUSINESS_LICENSE, label: '사업자등록증' },
        { code: COMPANY_DOC_TYPE_OWNER_ID, label: '대표자 신분증' },
        { code: COMPANY_DOC_TYPE_BANKBOOK, label: '통장사본' },
      ]}
      fetchDetailFn={fetchClientCompanyDetail}
      updateFn={updateClientCompany}
      fetchBusinessLicensePreviewFn={fetchClientCompanyBusinessLicensePreview}
      uploadBusinessLicenseFn={uploadClientCompanyBusinessLicense}
      deleteBusinessLicenseFn={canDeleteRequiredDocuments ? deleteClientCompanyBusinessLicense : undefined}
      fetchDocumentPreviewFn={fetchClientCompanyDocumentPreview}
      uploadDocumentFn={uploadClientCompanyDocument}
      deleteDocumentFn={canDeleteRequiredDocuments ? deleteClientCompanyDocument : undefined}
      listCustomDocumentsFn={listClientCompanyCustomDocuments}
      uploadCustomDocumentFn={uploadClientCompanyCustomDocument}
      uploadCustomDocumentsBulkFn={uploadClientCompanyCustomDocumentsBulk}
      deleteCustomDocumentFn={deleteClientCompanyCustomDocument}
      getCustomDocumentDownloadUrlFn={getClientCompanyCustomDocumentDownloadUrl}
      getCustomDocumentPreviewUrlFn={getClientCompanyCustomDocumentPreviewUrl}
      listCustomDocumentLogsFn={listClientCompanyCustomDocumentLogs}
      getHometaxCredentialFn={canManageHometax ? getClientHometaxCredential : undefined}
      upsertHometaxCredentialFn={canManageHometax ? upsertClientHometaxCredential : undefined}
      patchHometaxCredentialActiveFn={canManageHometax ? patchClientHometaxCredentialActive : undefined}
      revealHometaxCredentialPasswordFn={canManageHometax ? revealClientHometaxCredentialPassword : undefined}
      listHometaxCredentialLogsFn={canManageHometax ? listClientHometaxCredentialLogs : undefined}
      createCompanyAccountFn={createClientCompanyAccount}
      listCompanyAccountsFn={getClientCompanyAccounts}
      updateCompanyAccountStatusFn={updateClientCompanyAccountStatus}
    />
  )
}
