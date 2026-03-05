'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CompanyDetailResponse } from '@/types/admin_campany'
import { fetchCompanyDetail, updateCompany } from '@/services/company'
import { useParams } from 'next/navigation'

interface Props {
  company: CompanyDetailResponse
}

export default function CompanyDetailForm({ company }: Props) {
  const { id } = useParams()
  const companyId = Number(id)

  const [form, setForm] = useState<CompanyDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchCompanyDetail(companyId)
        setForm(data)
      } catch (err) {
        console.error('상세 정보 불러오기 실패:', err)
      } finally {
        setLoading(false)
      }
    }
    if (companyId) load()
  }, [companyId])

  if (loading) {
    return <p className="text-center mt-20 text-gray-400">회사 정보를 불러오는 중...</p>
  }

  if (!company || !form) {
    return <p className="text-center mt-20 text-red-500">회사 정보를 찾을 수 없습니다.</p>
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow rounded">
      <h1 className="text-2xl font-bold mb-6">업체 상세정보</h1>

      <section className="bg-gray-50 p-4 rounded border mb-6">
        <h2 className="text-base font-bold mb-3 text-blue-800">📌 기본 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">회사명</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">대표자</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.owner_name}
              onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">사업자등록번호</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.registration_number || ''}
              onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">설립일</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.founded_date || ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '').slice(0, 8)
                const formatted =
                  raw.length >= 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw
                setForm({ ...form, founded_date: formatted })
              }}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">수임일</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.contract_date || ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '').slice(0, 8)
                const formatted =
                  raw.length >= 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw
                setForm({ ...form, contract_date: formatted })
              }}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">구분</label>
            <select
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.category || ''}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="">선택</option>
              <option value="법인">법인</option>
              <option value="개인">개인</option>
            </select>
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">기장료</label>
            <input
              type="number"
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.monthly_fee ?? ''}
              onChange={(e) => setForm({ ...form, monthly_fee: Number(e.target.value) })}
            />
          </div>
        </div>
      </section>

      <section className="bg-gray-50 p-4 rounded border mb-6">
        <h2 className="text-base font-bold mb-3 text-blue-800">📌 담당자 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">담당자</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.manager_name || ''}
              onChange={(e) => setForm({ ...form, manager_name: e.target.value })}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">담당자 연락처</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.manager_phone || ''}
              onChange={(e) => setForm({ ...form, manager_phone: e.target.value })}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">담당자 ID</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full bg-gray-100"
              value={form.manager_customer_id ?? ''}
              readOnly
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">이메일</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.manager_email || ''}
              onChange={(e) => setForm({ ...form, manager_email: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="bg-gray-50 p-4 rounded border mb-6">
        <h2 className="text-base font-bold mb-3 text-blue-800">📌 연락 및 주소 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">홈페이지</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.homepage_url || ''}
              onChange={(e) => setForm({ ...form, homepage_url: e.target.value })}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">연락방법</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.contact_method || ''}
              onChange={(e) => setForm({ ...form, contact_method: e.target.value })}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">기본 주소</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.address1 || ''}
              onChange={(e) => setForm({ ...form, address1: e.target.value })}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">상세 주소</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.address2 || ''}
              onChange={(e) => setForm({ ...form, address2: e.target.value })}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">우편번호</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.postal_code || ''}
              onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">회사연락처</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.phone || ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="bg-gray-50 p-4 rounded border mb-6">
        <h2 className="text-base font-bold mb-3 text-blue-800">📌 업종 및 CMS 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">업태</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.industry_type || ''}
              onChange={(e) => setForm({ ...form, industry_type: e.target.value })}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">종목</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.business_type || ''}
              onChange={(e) => setForm({ ...form, business_type: e.target.value })}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">CMS 통장</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.cms_bank_account || ''}
              onChange={(e) => setForm({ ...form, cms_bank_account: e.target.value })}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">CMS 계좌번호</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.cms_account_number || ''}
              onChange={(e) => setForm({ ...form, cms_account_number: e.target.value })}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">CMS 이체일</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.cms_transfer_day || ''}
              onChange={(e) => setForm({ ...form, cms_transfer_day: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="bg-gray-50 p-4 rounded border mb-6">
        <h2 className="text-base font-bold mb-3 text-blue-800">📌 세금 및 급여 관련 특이사항</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">급여작성형태</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.salary_type || ''}
              onChange={(e) => setForm({ ...form, salary_type: e.target.value })}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">급여일</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.salary_date || ''}
              onChange={(e) => setForm({ ...form, salary_date: e.target.value })}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">원천세 특이사항</label>
            <textarea
              className="border border-gray-300 px-3 py-2 rounded w-full resize-y min-h-[80px]"
              value={form.w_memo || ''}
              onChange={(e) => setForm({ ...form, w_memo: e.target.value })}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">메모</label>
            <textarea
              className="border border-gray-300 px-3 py-2 rounded w-full resize-y min-h-[80px]"
              value={form.memo || ''}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="bg-gray-50 p-4 rounded border mb-6">
        <h2 className="text-base font-bold mb-3 text-blue-800">📌 홈택스 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">홈택스 ID</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.encrypted_hometax_id || ''}
              onChange={(e) => setForm({ ...form, encrypted_hometax_id: e.target.value })}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">홈택스 PW</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.encrypted_hometax_pw || ''}
              onChange={(e) => setForm({ ...form, encrypted_hometax_pw: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="bg-gray-50 p-4 rounded border mb-6">
        <h2 className="text-base font-bold mb-3 text-blue-800">📌 부가세 특이사항 및 비고</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">부가세 특이사항</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.v_note || ''}
              onChange={(e) => setForm({ ...form, v_note: e.target.value })}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">부가세 비고</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.v_remark || ''}
              onChange={(e) => setForm({ ...form, v_remark: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="bg-gray-50 p-4 rounded border mb-6">
        <h2 className="text-base font-bold mb-3 text-blue-800">📌 법인세 특이사항 및 비고</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">법인세 특이사항</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.ct_note || ''}
              onChange={(e) => setForm({ ...form, ct_note: e.target.value })}
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">법인세 비고</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full"
              value={form.ct_remark || ''}
              onChange={(e) => setForm({ ...form, ct_remark: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="bg-gray-50 p-4 rounded border mb-6">
        <h2 className="text-base font-bold mb-3 text-blue-800">📌 기타 정보</h2>
        <div className="flex flex-col space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              className="mr-2"
              checked={form.info_agreed || false}
              onChange={(e) => setForm({ ...form, info_agreed: e.target.checked })}
            />
            <label className="block mb-1 text-gray-700 text-sm font-semibold">정보활용동의</label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              className="mr-2"
              checked={form.is_half_term || false}
              onChange={(e) => setForm({ ...form, is_half_term: e.target.checked })}
            />
            <label className="block mb-1 text-gray-700 text-sm font-semibold">반기 여부</label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              className="mr-2"
              checked={form.is_export || false}
              onChange={(e) => setForm({ ...form, is_export: e.target.checked })}
            />
            <label className="block mb-1 text-gray-700 text-sm font-semibold">수출 여부</label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              className="mr-2"
              checked={form.is_online || false}
              onChange={(e) => setForm({ ...form, is_online: e.target.checked })}
            />
            <label className="block mb-1 text-gray-700 text-sm font-semibold">온라인 매출 여부</label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              className="mr-2"
              checked={form.has_foreign_currency || false}
              onChange={(e) => setForm({ ...form, has_foreign_currency: e.target.checked })}
            />
            <label className="block mb-1 text-gray-700 text-sm font-semibold">외화 여부</label>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 p-4 rounded border mb-6">
        <h2 className="text-base font-bold mb-3 text-blue-800">📌 시스템 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">등록일</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full bg-gray-100"
              value={form.created_at ?? ''}
              readOnly
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 text-sm font-semibold">수정일</label>
            <input
              className="border border-gray-300 px-3 py-2 rounded w-full bg-gray-100"
              value={form.updated_at ?? ''}
              readOnly
            />
          </div>
        </div>
      </section>

      <div className="mt-6">
        <button
          onClick={async () => {
            try {
              const {
                id,
                created_at,
                updated_at,
                ...payload
              } = form;

              const res = await updateCompany(companyId, payload);
              alert(res.message);
              router.push('/admin/companies'); // navigate after success
            } catch (err: any) {
              alert(err.response?.data?.detail || '수정 실패');
            }
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          수정완료
        </button>
      </div>
    </div>
  )
}