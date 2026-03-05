'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  fetchCompanyBusinessLicensePreview,
  fetchCompanyDetail,
  type CompanyDocumentPreviewResponse,
} from '@/services/admin/company'
import CompanyDetailForm from '@/components/admin/Company/CompanyDetailForm'
import type { CompanyDetailResponse } from '@/types/admin_campany'

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>()
  const companyId = Number(params.id)
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

  return <CompanyDetailForm company={company} editable={false} businessLicensePreview={businessLicensePreview} />
}
