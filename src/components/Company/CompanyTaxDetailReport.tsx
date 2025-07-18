'use client';

import { useEffect, useState } from 'react';
import { fetchCompanyTaxList } from '@/services/company';
import type { CompanyTaxDetail } from '@/types/admin_campany';
import { useRouter } from 'next/navigation';
import CompanyReportTabs from '@/components/Company/CompanyReportTabs';

export default function CompanyTaxDetailReport() {
  const [companies, setCompanies] = useState<CompanyTaxDetail[]>([]);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  const pageSize = 20;
  const router = useRouter();

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const { items, total } = await fetchCompanyTaxList({
          page,
          limit: pageSize,
          keyword: keyword.trim(),
          category: '',
        });
        const sortedItems = items.sort((a, b) => a.company_name.localeCompare(b.company_name, 'ko'));
        setCompanies(sortedItems);
        setTotalCount(total);
      } catch (error) {
        console.error('회사 목록 조회 실패:', error);
      }
    };

    loadCompanies();
  }, [page, keyword]);

  const selectedCompany = selectedCompanyId
    ? companies.find((c) => c.id === selectedCompanyId) || null
    : null;

  return (
    <div className="p-5 overflow-x-auto">
      <div className="mb-4 flex gap-6 flex-wrap items-end">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="회사명 검색"
          className="border px-3 py-1 rounded"
        />
        <select
          className="border px-3 py-1 rounded"
          value={selectedCompanyId ?? ''}
          onChange={(e) => {
            const id = Number(e.target.value);
            setSelectedCompanyId(id);
          }}
        >
          <option value="">회사 선택</option>
          {companies
            .filter((company) =>
              company.company_name.includes(keyword.trim())
            )
            .map((company) => (
              <option key={company.id} value={company.id}>
                {company.company_name}
              </option>
            ))}
        </select>
      </div>

      <table className="min-w-[1400px] table-fixed border border-gray-300 mb-6 bg-white text-m">
        <thead>
          <tr className="bg-[#456bbd] border-b border-gray-300 text-white font-bold">
            <th colSpan={3} className="px-4 py-2 font-semibold border-r border-gray-300">기본정보</th>
            <th colSpan={3} className="px-4 py-2 font-semibold">원천세</th>
          </tr>
          <tr className="bg-[#456bbd] border-b border-gray-300 text-white font-bold">
            <th className="px-4 py-2 border-r border-gray-200">회사명</th>
            <th className="px-4 py-2 border-r border-gray-200">대표자</th>
            <th className="px-4 py-2 border-r border-gray-300">사업자등록번호</th>
            <th className="px-4 py-2 border-r border-gray-200">반기</th>
            <th className="px-4 py-2 border-r border-gray-200">급여일</th>
            <th className="px-4 py-2">급여작성</th>
          </tr>
        </thead>
        <tbody className="w-full table-fixed border text-center border-gray-300 mb-6 bg-white text-sm">
          <tr>
            <td className="px-4 py-2 border-r border-gray-200">{selectedCompany?.company_name || ''}</td>
            <td className="px-4 py-2 border-r border-gray-200">{selectedCompany?.owner_name || ''}</td>
            <td className="px-4 py-2 border-r border-gray-300">{selectedCompany?.registration_number || ''}</td>
            <td className="px-4 py-2 border-r border-gray-200">{selectedCompany ? (selectedCompany.is_half_term ? '예' : '아니오') : ''}</td>
            <td className="px-4 py-2 border-r border-gray-200">{selectedCompany?.salary_date || ''}</td>
            <td className="px-4 py-2 border-r border-gray-200">{selectedCompany?.salary_type || ''}</td>
          </tr>
        </tbody>
      </table>

      {/* 탭 컴포넌트 출력 */}
      <CompanyReportTabs selectedCompany={selectedCompany} />
    </div>
  );
}