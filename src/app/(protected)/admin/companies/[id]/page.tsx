'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  COMPANY_DOC_TYPE_BANKBOOK,
  COMPANY_DOC_TYPE_BUSINESS_LICENSE,
  COMPANY_DOC_TYPE_OWNER_ID,
  deleteCompanyBusinessLicense,
  deleteCompanyDocument,
  fetchCompanyBusinessLicensePreview,
  fetchCompanyDocumentPreview,
  fetchCompanyDetail,
  uploadAdminCompanyCustomDocument,
  uploadAdminCompanyCustomDocumentsBulk,
  deleteAdminCompanyCustomDocument,
  getAdminCompanyCustomDocumentDownloadUrl,
  getAdminCompanyCustomDocumentPreviewUrl,
  getAdminHometaxCredential,
  listAdminCompanyCustomDocumentLogs,
  listAdminCompanyCustomDocuments,
  listAdminHometaxCredentialLogs,
  patchAdminHometaxCredentialActive,
  revealAdminHometaxCredentialPassword,
  upsertAdminHometaxCredential,
  updateCompany,
  uploadCompanyBusinessLicense,
  uploadCompanyDocument,
  type CompanyDocumentPreviewResponse,
} from '@/services/admin/company'
import CompanyDetailForm from '@/components/admin/Company/CompanyDetailForm'
import { useAdminSessionContext } from '@/contexts/AdminSessionContext'
import { getAdminRoleRank } from '@/utils/roleRank'
import type { CompanyDetailResponse } from '@/types/admin_campany'

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>()
  const { session } = useAdminSessionContext()
  const companyId = Number(params.id)
  const canDeleteRequiredDocuments = getAdminRoleRank(session) === 0
  const [company, setCompany] = useState<CompanyDetailResponse | null>(null)
  const [businessLicensePreview, setBusinessLicensePreview] = useState<CompanyDocumentPreviewResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!companyId) return
    const load = async () => {
      try {
        const [detail, preview] = await Promise.all([
          fetchCompanyDetail(companyId),
          fetchCompanyBusinessLicensePreview(companyId).catch(() => null),
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
      updateFn={updateCompany}
      businessLicensePreview={businessLicensePreview}
      documentTypes={[
        { code: COMPANY_DOC_TYPE_BUSINESS_LICENSE, label: '사업자등록증' },
        { code: COMPANY_DOC_TYPE_OWNER_ID, label: '대표자 신분증' },
        { code: COMPANY_DOC_TYPE_BANKBOOK, label: '통장사본' },
      ]}
      fetchBusinessLicensePreviewFn={fetchCompanyBusinessLicensePreview}
      uploadBusinessLicenseFn={uploadCompanyBusinessLicense}
      deleteBusinessLicenseFn={canDeleteRequiredDocuments ? deleteCompanyBusinessLicense : undefined}
      fetchDocumentPreviewFn={fetchCompanyDocumentPreview}
      uploadDocumentFn={uploadCompanyDocument}
      deleteDocumentFn={canDeleteRequiredDocuments ? deleteCompanyDocument : undefined}
      enableCustomDocuments
      listCustomDocumentsFn={listAdminCompanyCustomDocuments}
      uploadCustomDocumentFn={uploadAdminCompanyCustomDocument}
      uploadCustomDocumentsBulkFn={uploadAdminCompanyCustomDocumentsBulk}
      deleteCustomDocumentFn={deleteAdminCompanyCustomDocument}
      getCustomDocumentDownloadUrlFn={getAdminCompanyCustomDocumentDownloadUrl}
      getCustomDocumentPreviewUrlFn={getAdminCompanyCustomDocumentPreviewUrl}
      listCustomDocumentLogsFn={listAdminCompanyCustomDocumentLogs}
      getHometaxCredentialFn={getAdminHometaxCredential}
      upsertHometaxCredentialFn={upsertAdminHometaxCredential}
      patchHometaxCredentialActiveFn={patchAdminHometaxCredentialActive}
      revealHometaxCredentialPasswordFn={revealAdminHometaxCredentialPassword}
      listHometaxCredentialLogsFn={listAdminHometaxCredentialLogs}
    />
  )
}
