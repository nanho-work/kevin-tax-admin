'use client';

import { useEffect, useState } from 'react';
import { fetchCompanyTaxList } from '@/services/admin/company';
import { getCompanyAccounts } from '@/services/admin/companyAccountService'
import type { CompanyTaxDetail } from '@/types/admin_campany';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { PaginatedResponse } from '@/types/admin_campany';
import Pagination from '@/components/common/Pagination'
import UiButton from '@/components/common/UiButton'
import UiSearchInput from '@/components/common/UiSearchInput'

interface Props {
  detailBasePath?: string;
  fetchList?: (params: {
    page: number
    limit: number
    keyword?: string
    category?: '법인' | '개인'
    business_type?: 'individual' | 'corporate'
  }) => Promise<PaginatedResponse<CompanyTaxDetail>>;
  deactivate?: (companyId: number) => Promise<{ message?: string }>;
  disableDelete?: boolean;
  pageSize?: number;
  createHref?: string;
  createLabel?: string;
  showAccountStatus?: boolean;
}

type CategoryFilter = '' | '법인' | '개인'

function mapLegacyBusinessTypeToCategory(value: string | null): CategoryFilter {
  if (value === 'corporate') return '법인'
  if (value === 'individual') return '개인'
  return ''
}

function resolveCompanyCategory(row: CompanyTaxDetail): CategoryFilter {
  if (row.category === '법인' || row.category === '개인') return row.category
  if (row.business_type === 'corporate') return '법인'
  if (row.business_type === 'individual') return '개인'
  return ''
}

export default function CompanyList({
  detailBasePath = '/admin/companies',
  fetchList = fetchCompanyTaxList,
  deactivate,
  disableDelete = true,
  pageSize = 12,
  createHref,
  createLabel = '고객사등록',
  showAccountStatus = true,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [allCompanies, setAllCompanies] = useState<CompanyTaxDetail[]>([]);
  const [companies, setCompanies] = useState<CompanyTaxDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [keyword, setKeyword] = useState(() => searchParams.get('keyword') || '');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(() => {
    const category = searchParams.get('category')
    if (category === '법인' || category === '개인') return category
    return mapLegacyBusinessTypeToCategory(searchParams.get('business_type'))
  })
  const [page, setPage] = useState(() => {
    const parsed = Number(searchParams.get('page') || 1)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  });
  const [totalCount, setTotalCount] = useState(0);
  const [companyAccountIds, setCompanyAccountIds] = useState<Set<number> | null>(null)

  useEffect(() => {
    setPage(1);
  }, [keyword, categoryFilter]);

  useEffect(() => {
    const nextKeyword = searchParams.get('keyword') || ''
    const nextCategoryRaw = searchParams.get('category')
    const nextCategory =
      nextCategoryRaw === '법인' || nextCategoryRaw === '개인'
        ? nextCategoryRaw
        : mapLegacyBusinessTypeToCategory(searchParams.get('business_type'))
    const parsedPage = Number(searchParams.get('page') || 1)
    const nextPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1

    setKeyword(nextKeyword)
    setCategoryFilter(nextCategory)
    setPage(nextPage)
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams()
    if (page > 1) params.set('page', String(page))
    if (keyword.trim()) params.set('keyword', keyword.trim())
    if (categoryFilter) params.set('category', categoryFilter)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [page, keyword, categoryFilter, pathname, router]);

  useEffect(() => {
    const loadCompanies = async () => {
      setLoading(true);
      try {
        setErrorMessage(null);
        const batchSize = Math.max(pageSize, 100)
        let cursor = 1
        let total = 0
        const merged: CompanyTaxDetail[] = []

        do {
          const { items, total: totalCountFromApi } = await fetchList({
            page: cursor,
            limit: batchSize,
            keyword: keyword.trim(),
            category: categoryFilter || undefined,
          })
          merged.push(...(items || []))
          total = totalCountFromApi || merged.length
          cursor += 1
          if (!items || items.length === 0) break
        } while (merged.length < total)

        const filtered =
          categoryFilter === ''
            ? merged
            : merged.filter((item) => resolveCompanyCategory(item) === categoryFilter)
        const sorted = [...filtered].sort((a, b) => a.company_name.localeCompare(b.company_name, 'ko'))
        setAllCompanies(sorted)
        setTotalCount(sorted.length)
      } catch (err) {
        const status = (err as any)?.response?.status;
        if (status === 404) {
          setErrorMessage(null);
          setAllCompanies([]);
          setCompanies([]);
          setTotalCount(0);
          return;
        }
        console.error('회사 목록 조회 실패:', err);
        setErrorMessage('회사 목록을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    loadCompanies();
  }, [keyword, categoryFilter, pageSize, fetchList]);

  useEffect(() => {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    setCompanies(allCompanies.slice(start, end))
  }, [allCompanies, page, pageSize]);

  useEffect(() => {
    if (!showAccountStatus) {
      setCompanyAccountIds(null)
      return
    }

    const loadCompanyAccounts = async () => {
      try {
        let nextPage = 1
        let total = 0
        const companyIds = new Set<number>()

        do {
          const response = await getCompanyAccounts({
            page: nextPage,
            limit: 100,
          })
          ;(response.items || []).forEach((item) => {
            companyIds.add(item.company_id)
          })
          total = response.total || companyIds.size
          nextPage += 1
          if (!response.items || response.items.length === 0) break
        } while (companyIds.size < total)

        setCompanyAccountIds(companyIds)
      } catch (err: any) {
        if (err?.response?.status === 403) {
          setCompanyAccountIds(null)
          return
        }
        console.error('고객사 계정 목록 조회 실패:', err)
        setCompanyAccountIds(null)
      }
    }

    const handleWindowFocus = () => {
      void loadCompanyAccounts()
    }

    void loadCompanyAccounts()
    window.addEventListener('focus', handleWindowFocus)

    return () => {
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [showAccountStatus])

  const columns = showAccountStatus
    ? ['번호', '구분', '회사명', '상세보기', '대표자', '사업자등록번호', '종목', '계정']
    : ['번호', '구분', '회사명', '상세보기', '대표자', '사업자등록번호', '종목']
  const columnCount = columns.length

  const handleDelete = async (companyId: number) => {
    if (!deactivate) {
      toast.error('삭제 기능이 제공되지 않습니다.')
      return
    }
    if (!confirm('해당 회사를 삭제하시겠습니까?')) return

    try {
      await deactivate(companyId)
      toast.success('삭제 완료')
      setAllCompanies((prev) => prev.filter((c) => c.id !== companyId))
      setTotalCount((prev) => Math.max(0, prev - 1))
    } catch (err) {
      console.error('삭제 실패:', err)
      toast.error('삭제 중 오류가 발생했습니다.')
    }
  };

  return (
    <div className="w-full max-w-[100vw] space-y-4 overflow-x-hidden">
      {errorMessage ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="w-full overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="mb-4 flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white p-3">
            <div className="flex items-center gap-2">
              {createHref ? (
                <Link
                  href={createHref}
                  className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  {createLabel}
                </Link>
              ) : null}
              <div className="text-sm text-zinc-500">총 {totalCount}개</div>
            </div>
            <div className="ml-auto flex gap-2">
              <UiSearchInput
                value={keyword}
                onChange={setKeyword}
                placeholder="회사명 또는 사업자번호"
                wrapperClassName="w-[260px]"
              />
              <div className="inline-flex h-10 items-center rounded-md border border-zinc-200 bg-white p-1">
                <UiButton
                  onClick={() => setCategoryFilter('')}
                  variant={categoryFilter === '' ? 'primary' : 'tabInactive'}
                  size="sm"
                >
                  전체
                </UiButton>
                <UiButton
                  onClick={() => setCategoryFilter('법인')}
                  variant={categoryFilter === '법인' ? 'primary' : 'tabInactive'}
                  size="sm"
                >
                  법인
                </UiButton>
                <UiButton
                  onClick={() => setCategoryFilter('개인')}
                  variant={categoryFilter === '개인' ? 'primary' : 'tabInactive'}
                  size="sm"
                >
                  개인
                </UiButton>
              </div>
            </div>
          </div>

          <div className="w-full max-w-full overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="min-w-full table-auto text-sm">
              <thead className="bg-zinc-50 text-zinc-700">
                <tr>
                  {columns.map((title) => (
                    <th key={title} className="h-10 border-b border-zinc-200 px-2 py-1 text-center whitespace-nowrap text-xs font-medium">
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {loading ? (
                  <tr>
                    <td colSpan={columnCount} className="px-4 py-10 text-center text-sm text-zinc-500">
                      회사 목록을 불러오는 중입니다...
                    </td>
                  </tr>
                ) : companies.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount} className="px-4 py-10 text-center text-sm text-zinc-500">
                      조회된 회사가 없습니다.
                    </td>
                  </tr>
                ) : (
                  companies.map((c, idx) => (
                    <tr key={c.id} className="even:bg-zinc-50">
                      <td className="h-10 px-2 text-center">{(page - 1) * pageSize + idx + 1}</td>
                      <td className="h-10 px-2 text-center">{resolveCompanyCategory(c) || '-'}</td>
                      <td className="h-10 px-2 text-center text-zinc-900">{c.company_name}</td>
                      <td className="h-10 px-2 text-center">
                        {(() => {
                          const params = new URLSearchParams()
                          if (page > 1) params.set('page', String(page))
                          if (keyword.trim()) params.set('keyword', keyword.trim())
                          if (categoryFilter) params.set('category', categoryFilter)
                          if (c.company_name?.trim()) params.set('company_name', c.company_name.trim())
                          const query = params.toString()
                          const href = query ? `${detailBasePath}/${c.id}?${query}` : `${detailBasePath}/${c.id}`
                          return (
                        <Link
                          href={href}
                          className="inline-flex h-7 items-center rounded-md border border-zinc-300 px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                        >
                          상세보기
                        </Link>
                          )
                        })()}
                      </td>
                      <td className="h-10 px-2 text-center whitespace-nowrap">{c.owner_name}</td>
                      <td className="h-10 px-2 text-center whitespace-nowrap">{c.registration_number}</td>
                      <td className="h-10 px-2 text-center whitespace-nowrap">{c.business_type || '-'}</td>
                      {showAccountStatus ? (
                        <td className="h-10 px-2 text-center whitespace-nowrap">
                          {companyAccountIds === null ? (
                            <span className="text-zinc-400">-</span>
                          ) : companyAccountIds.has(c.id) ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                              있음
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
                              없음
                            </span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination page={page} total={totalCount} limit={pageSize} onPageChange={setPage} />

        </div>
      </div>
    </div>
  );
}
