'use client';

import { engagementLabel, staffPhone } from './CompanyManagementFields'
import { useEffect, useState } from 'react';
import { fetchCompanyTaxList } from '@/services/admin/company';
import { getCompanyAccounts } from '@/services/admin/companyAccountService'
import type { CompanyTaxDetail } from '@/types/admin_campany';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { PaginatedResponse } from '@/types/admin_campany';
import Pagination from '@/components/common/Pagination'
import { ArrowUpRight, Building2, Plus, SearchX } from 'lucide-react'
import UiSearchInput from '@/components/common/UiSearchInput'
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext'

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
  createActions?: Array<{ href: string; label: string }>;
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

function formatBusinessNumber(value?: string | null): string {
  if (!value?.trim()) return '사업자번호 미등록'
  const digits = value.replace(/\D/g, '')
  return digits.length === 10
    ? `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
    : value
}

export default function CompanyList({
  detailBasePath = '/admin/companies',
  fetchList = fetchCompanyTaxList,
  deactivate,
  disableDelete = true,
  pageSize = 12,
  createHref,
  createLabel = '거래처 등록',
  createActions,
  showAccountStatus = true,
}: Props) {
  const { confirm } = useConfirmDialog()
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
    ? ['구분', '거래처명', '계약 구분', '대표자', '종목', '담당 직원', '계정']
    : ['구분', '거래처명', '계약 구분', '대표자', '종목', '담당 직원']
  const columnCount = columns.length

  const handleDelete = async (companyId: number) => {
    if (!deactivate) {
      toast.error('삭제 기능이 제공되지 않습니다.')
      return
    }
    const ok = await confirm({
      title: '회사 삭제',
      description: '해당 회사를 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'danger',
    })
    if (!ok) return

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
    <section className="min-w-0 space-y-5">
      {errorMessage ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</p> : null}

      <div className="overflow-hidden rounded-2xl bg-white">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-slate-100 p-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <h1 className="whitespace-nowrap text-base font-semibold tracking-tight text-slate-900">거래처 관리</h1>
              <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-500">
                {loading ? '조회 중' : `${keyword || categoryFilter ? '검색 결과' : '총'} ${totalCount.toLocaleString()}개`}
              </span>
            </div>
            <div role="group" aria-label="거래처 구분" className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-slate-100/80 p-1">
              {(['', '법인', '개인'] as const).map((category) => (
                <button key={category} type="button" aria-pressed={categoryFilter === category} onClick={() => setCategoryFilter(category)} className={`rounded-lg px-4 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${categoryFilter === category ? 'bg-white text-sky-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  {category || '전체'}
                </button>
              ))}
            </div>
          </div>
          <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <UiSearchInput value={keyword} onChange={setKeyword} aria-label="거래처명 또는 사업자번호 검색" placeholder="거래처명 또는 사업자번호 검색" wrapperClassName="min-w-0 flex-1 sm:w-64 sm:flex-none !rounded-xl !border-slate-200" />
            {createHref ? (
              <div className="flex flex-wrap gap-2">
                {(createActions?.length ? createActions : [{ href: createHref, label: createLabel }]).map((action, index) => (
                  <Link key={`${action.href}:${action.label}`} href={action.href} className={`inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${index === 0 ? 'bg-sky-600 text-white hover:bg-sky-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    <Plus size={15} aria-hidden="true" />{action.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto" role="region" aria-label="거래처 목록" tabIndex={0}>
          <table className="w-full min-w-[560px] text-sm" aria-busy={loading}>
            <thead className="bg-slate-50/80">
              <tr>
                {columns.map((title) => (
                  <th key={title} scope="col" className={`h-10 whitespace-nowrap border-b border-slate-100 px-4 text-xs font-medium text-slate-500 ${['구분', '계정'].includes(title) ? 'text-center' : 'text-left'}`}>{title}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={columnCount} className="px-4 py-16 text-center text-sm text-slate-400" role="status">거래처 목록을 불러오는 중입니다...</td></tr>
              ) : companies.length === 0 ? (
                <tr><td colSpan={columnCount} className="px-4 py-14 text-center">
                  <SearchX size={28} strokeWidth={1.5} className="mx-auto mb-3 text-slate-300" aria-hidden="true" />
                  <p className="text-sm font-medium text-slate-600">{errorMessage ? '거래처 목록을 표시할 수 없습니다.' : keyword || categoryFilter ? '검색 결과가 없습니다.' : '등록된 거래처가 없습니다.'}</p>
                  <p className="mt-1.5 text-xs text-slate-400">{errorMessage ? '잠시 후 다시 확인해 주세요.' : keyword || categoryFilter ? '검색어나 구분을 변경해 보세요.' : '거래처를 등록하고 관리를 시작하세요.'}</p>
                </td></tr>
              ) : companies.map((company) => {
                const category = resolveCompanyCategory(company)
                const params = new URLSearchParams()
                if (page > 1) params.set('page', String(page))
                if (keyword.trim()) params.set('keyword', keyword.trim())
                if (categoryFilter) params.set('category', categoryFilter)
                if (company.company_name?.trim()) params.set('company_name', company.company_name.trim())
                const query = params.toString()
                const href = `${detailBasePath}/${company.id}${query ? `?${query}` : ''}`
                return (
                  <tr key={company.id} className="group transition-colors hover:bg-sky-50/40">
                    <td className="w-20 px-4 py-3 text-center"><span className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium ${category === '법인' ? 'bg-sky-50 text-sky-700' : category === '개인' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>{category || '미지정'}</span></td>
                    <td className="min-w-[200px] px-4 py-3">
                      <Link href={href} className="inline-flex max-w-full items-center gap-2 rounded font-medium text-slate-800 transition hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                        <Building2 size={16} strokeWidth={1.5} className="shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="break-words">{company.company_name}</span>
                        <ArrowUpRight size={14} className="shrink-0 text-slate-300 group-hover:text-sky-600" aria-hidden="true" />
                      </Link>
                      <p className="mt-1 pl-6 text-xs tabular-nums text-slate-400">
                        <span className="sr-only">사업자등록번호: </span>
                        {formatBusinessNumber(company.registration_number)}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{engagementLabel(company.engagement_type)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{company.owner_name || '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{company.business_type || '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600"><p>{company.assigned_admin_name || '미지정'}</p>{company.assigned_admin_id ? <p className="mt-1 text-xs text-slate-400">{staffPhone(company.assigned_admin_phone)}</p> : null}</td>
                    {showAccountStatus ? <td className="whitespace-nowrap px-4 py-3 text-center">
                      {companyAccountIds === null ? <span className="text-slate-400">-</span> : companyAccountIds.has(company.id) ? <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />등록됨</span> : <span className="text-xs text-slate-400">미등록</span>}
                    </td> : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 pb-3">
          <Pagination page={page} total={totalCount} limit={pageSize} onPageChange={setPage} />
        </div>
      </div>
    </section>
  );
}
