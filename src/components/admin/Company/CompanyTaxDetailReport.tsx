'use client';

import { useEffect, useState } from 'react';
import { fetchCompanyTaxList } from '@/services/admin/company';
import type { CompanyTaxDetail } from '@/types/admin_campany';
import { useRouter } from 'next/navigation';
import CompanyReportTabs from '@/components/admin/Company/CompanyReportTabs';

export default function CompanyTaxDetailReport() {
  const [companies, setCompanies] = useState<CompanyTaxDetail[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  const pageSize = 20;
  const router = useRouter();

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);
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
        setErrorMessage('회사 목록을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadCompanies();
  }, [page, keyword]);

  const selectedCompany = selectedCompanyId
    ? companies.find((c) => c.id === selectedCompanyId) || null
    : null;

  return (
    <div className="space-y-4 overflow-x-auto">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 text-base font-semibold text-zinc-900">회사 선택</div>
        <div className="flex flex-wrap items-end gap-3">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="회사명 검색"
            className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
          />
          <select
            className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
            value={selectedCompanyId ?? ''}
            onChange={(e) => {
              const id = Number(e.target.value);
              setSelectedCompanyId(id || null);
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
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-[1200px] w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-600">
              <th colSpan={3} className="px-4 py-3 text-center">기본정보</th>
              <th colSpan={3} className="px-4 py-3 text-center">원천세</th>
            </tr>
            <tr className="border-b border-zinc-200 bg-white text-xs text-zinc-500">
              <th className="px-4 py-3 text-left">회사명</th>
              <th className="px-4 py-3 text-center">대표자</th>
              <th className="px-4 py-3 text-center">사업자등록번호</th>
              <th className="px-4 py-3 text-center">반기</th>
              <th className="px-4 py-3 text-center">급여일</th>
              <th className="px-4 py-3 text-center">급여작성</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-500">
                  회사 정보를 불러오는 중입니다...
                </td>
              </tr>
            ) : !selectedCompany ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-500">
                  회사를 선택하면 기본 요약 정보가 표시됩니다.
                </td>
              </tr>
            ) : (
              <tr className="bg-white">
                <td className="px-4 py-3 text-left font-medium text-zinc-900">{selectedCompany.company_name || '-'}</td>
                <td className="px-4 py-3 text-center">{selectedCompany.owner_name || '-'}</td>
                <td className="px-4 py-3 text-center">{selectedCompany.registration_number || '-'}</td>
                <td className="px-4 py-3 text-center">{selectedCompany.is_half_term ? '예' : '아니오'}</td>
                <td className="px-4 py-3 text-center">{selectedCompany.salary_date || '-'}</td>
                <td className="px-4 py-3 text-center">{selectedCompany.salary_type || '-'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 탭 컴포넌트 출력 */}
      <CompanyReportTabs selectedCompany={selectedCompany} />
    </div>
  );
}
