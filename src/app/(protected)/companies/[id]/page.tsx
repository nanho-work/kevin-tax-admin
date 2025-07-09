'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { fetchCompanyDetail } from '@/services/company'
import CompanyDetailForm from '@/components/Company/CompanyDetailForm'
import type { CompanyDetailResponse } from '@/types/admin_campany'

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>()
  const companyId = Number(params.id)
  const [company, setCompany] = useState<CompanyDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!companyId) return
    const load = async () => {
      try {
        const data = await fetchCompanyDetail(companyId)
        setCompany(data)
      } catch (err) {
        console.error('상세 정보 조회 실패:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [companyId])

  if (loading) return <p className="text-center mt-20 text-gray-400">회사 정보를 불러오는 중...</p>
  if (!company) return <p className="text-center mt-20 text-red-500">회사 정보를 찾을 수 없습니다.</p>

  return <CompanyDetailForm company={company} />
}
