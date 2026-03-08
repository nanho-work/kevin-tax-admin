'use client';

import { useEffect, useState } from 'react';
import { fetchCompanyTaxList } from '@/services/admin/company';
import { getCompanyAccounts } from '@/services/admin/companyAccountService'
import type { CompanyTaxDetail } from '@/types/admin_campany';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { PaginatedResponse } from '@/types/admin_campany';

interface Props {
  detailBasePath?: string;
  fetchList?: (params: {
    page: number
    limit: number
    keyword?: string
    business_type?: 'individual' | 'corporate'
  }) => Promise<PaginatedResponse<CompanyTaxDetail>>;
  deactivate?: (companyId: number) => Promise<{ message?: string }>;
  disableDelete?: boolean;
  pageSize?: number;
  createHref?: string;
  createLabel?: string;
  showAccountStatus?: boolean;
}

export default function CompanyList({
  detailBasePath = '/admin/companies',
  fetchList = fetchCompanyTaxList,
  deactivate,
  disableDelete = true,
  pageSize = 12,
  createHref,
  createLabel = '거래처등록',
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
  const [businessType, setBusinessType] = useState<'' | 'individual' | 'corporate'>(() => {
    const type = searchParams.get('business_type')
    return type === 'individual' || type === 'corporate' ? type : ''
  });
  const [page, setPage] = useState(() => {
    const parsed = Number(searchParams.get('page') || 1)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  });
  const [totalCount, setTotalCount] = useState(0);
  const [companyAccountIds, setCompanyAccountIds] = useState<Set<number> | null>(null)

  useEffect(() => {
    setPage(1);
  }, [keyword, businessType]);

  useEffect(() => {
    const nextKeyword = searchParams.get('keyword') || ''
    const nextTypeRaw = searchParams.get('business_type')
    const nextType = nextTypeRaw === 'individual' || nextTypeRaw === 'corporate' ? nextTypeRaw : ''
    const parsedPage = Number(searchParams.get('page') || 1)
    const nextPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1

    setKeyword(nextKeyword)
    setBusinessType(nextType)
    setPage(nextPage)
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams()
    if (page > 1) params.set('page', String(page))
    if (keyword.trim()) params.set('keyword', keyword.trim())
    if (businessType) params.set('business_type', businessType)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [page, keyword, businessType, pathname, router]);

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
            business_type: businessType || undefined,
          })
          merged.push(...(items || []))
          total = totalCountFromApi || merged.length
          cursor += 1
          if (!items || items.length === 0) break
        } while (merged.length < total)

        const sorted = [...merged].sort((a, b) => a.company_name.localeCompare(b.company_name, 'ko'))
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
  }, [keyword, businessType, pageSize, fetchList]);

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
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="회사명 또는 사업자번호"
                className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              />
              <div className="inline-flex h-10 items-center rounded-md border border-zinc-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setBusinessType('')}
                  className={`rounded px-3 py-1.5 text-sm transition ${
                    businessType === '' ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  전체
                </button>
                <button
                  type="button"
                  onClick={() => setBusinessType('corporate')}
                  className={`rounded px-3 py-1.5 text-sm transition ${
                    businessType === 'corporate' ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  법인
                </button>
                <button
                  type="button"
                  onClick={() => setBusinessType('individual')}
                  className={`rounded px-3 py-1.5 text-sm transition ${
                    businessType === 'individual' ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  개인
                </button>
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
                      <td className="h-10 px-2 text-center">{c.category || '-'}</td>
                      <td className="h-10 px-2 text-center text-zinc-900">{c.company_name}</td>
                      <td className="h-10 px-2 text-center">
                        {(() => {
                          const params = new URLSearchParams()
                          if (page > 1) params.set('page', String(page))
                          if (keyword.trim()) params.set('keyword', keyword.trim())
                          if (businessType) params.set('business_type', businessType)
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

          <div className="mt-4 flex items-center justify-center gap-2 text-sm">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="rounded border border-zinc-200 bg-white px-3 py-1 hover:bg-zinc-50 disabled:opacity-50"
            >
              ◀
            </button>

            {Array.from({ length: Math.ceil(totalCount / pageSize) }, (_, i) => i + 1)
              .filter((p) => Math.abs(p - page) <= 2 || p === 1 || p === Math.ceil(totalCount / pageSize))
              .map((p, idx, arr) => {
                const isEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                return isEllipsis ? (
                  <span key={`ellipsis-${p}`} className="px-1">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`rounded border px-3 py-1 ${
                      p === page
                        ? 'border-zinc-900 bg-zinc-900 font-semibold text-white'
                        : 'border-zinc-200 bg-white hover:bg-zinc-100'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

            <button
              onClick={() => setPage((prev) => Math.min(Math.ceil(totalCount / pageSize), prev + 1))}
              disabled={page === Math.ceil(totalCount / pageSize)}
              className="rounded border border-zinc-200 bg-white px-3 py-1 hover:bg-zinc-50 disabled:opacity-50"
            >
              ▶
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
