'use client';

import { useEffect, useState } from 'react';
import { fetchCompanyTaxList, deactivateCompany, updateCompany as apiUpdateCompany } from '@/services/company';
import type { CompanyTaxDetail, CompanyUpdateRequest } from '@/types/admin_campany';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import MemoEditModal from '@/components/Company/MemoEditModal';

async function updateCompany(id: number, data: Partial<CompanyTaxDetail>) {
  try {
    await apiUpdateCompany(id, data as CompanyUpdateRequest);
  } catch (error) {
    console.error('회사 정보 업데이트 실패:', error);
    throw error;
  }
}

export default function CompanyList() {
  const [companies, setCompanies] = useState<CompanyTaxDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<{
    id: number;
    field: 'memo' | 'w_memo' | 'v_note' | 'v_remark' | 'ct_note' | 'ct_remark';
    value: string;
  } | null>(null);

  const pageSize = 9;

  useEffect(() => {
    const loadCompanies = async () => {
      setLoading(true);
      try {
        setErrorMessage(null);
        const { items, total } = await fetchCompanyTaxList({
          page,
          limit: pageSize,
          keyword: keyword.trim(),
          category,
        });
        setCompanies(items);
        setTotalCount(total);
      } catch (err) {
        console.error('회사 목록 조회 실패:', err);
        setErrorMessage('회사 목록을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    loadCompanies();
  }, [page, keyword, category]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(companies.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((i) => i !== id)));
  };

  const handleDelete = async () => {
    if (selectedIds.length === 0) {
      toast('삭제할 회사를 선택해주세요.', {
        icon: '⚠️',
        style: {
          border: '1px solid #facc15',
          padding: '8px 12px',
          color: '#713f12',
        },
      });
      return;
    }

    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      await Promise.all(selectedIds.map((id) => deactivateCompany(id)));
      toast.success('삭제 완료');
      setCompanies((prev) => prev.filter((c) => !selectedIds.includes(c.id)));
      setSelectedIds([]);
    } catch (err) {
      console.error('삭제 실패:', err);
      toast.error('삭제 중 오류가 발생했습니다.');
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
        <div className="min-w-[1000px]">
          <div className="mb-4 flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white p-3">
            {selectedIds.length > 0 ? (
              <div className="flex gap-3">
                <button
                  className="rounded-md bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700"
                  onClick={handleDelete}
                >
                  선택 삭제
                </button>
              </div>
            ) : (
              <div className="text-sm text-zinc-500">총 {totalCount}개</div>
            )}
            <div className="ml-auto flex gap-2">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="회사명 또는 사업자번호"
                className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </div>
          </div>

          <div className="w-full max-w-full overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <div className="min-w-full overflow-x-auto">
              <table className="table-auto w-max text-sm">
                <thead className="bg-zinc-50 text-zinc-700">
                  <tr>
                    <th rowSpan={2} className="h-10 border border-zinc-200 px-2 py-1 text-center text-xs font-medium">
                      <input
                        type="checkbox"
                        onChange={handleSelectAll}
                        checked={selectedIds.length === companies.length && companies.length > 0}
                      />
                    </th>
                    <th colSpan={15} className="h-10 border border-zinc-200 px-2 py-1 text-center text-xs">기본사항</th>
                    <th colSpan={4} className="h-10 border border-zinc-200 px-2 py-1 text-center text-xs">원천세</th>
                    <th colSpan={4} className="h-10 border border-zinc-200 px-2 py-1 text-center text-xs">부가세</th>
                    <th colSpan={3} className="h-10 border border-zinc-200 px-2 py-1 text-center text-xs">법인세/종소세</th>
                  </tr>
                  <tr>
                    {[
                      '구분', '회사명', '대표자', '담당자', '연락처', '이메일', '연락방법', '메모', '사업자등록번호', '기장료',
                      '수임일', '종목', 'CMS 통장', 'CMS 계좌', 'CMS 이체일',
                      '반기', '급여일', '급여작성', '원천세 메모', '온라인', '수출', '부가세 메모', '부가세 비고',
                      '외화', '법인세 메모', '법인세 비고',
                    ].map((title) => (
                      <th key={title} className="h-10 border border-zinc-200 px-2 py-1 text-center whitespace-nowrap text-xs">
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {loading ? (
                    <tr>
                      <td colSpan={27} className="px-4 py-10 text-center text-sm text-zinc-500">
                        회사 목록을 불러오는 중입니다...
                      </td>
                    </tr>
                  ) : companies.length === 0 ? (
                    <tr>
                      <td colSpan={27} className="px-4 py-10 text-center text-sm text-zinc-500">
                        조회된 회사가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    companies.map((c) => (
                      <tr key={c.id} className="even:bg-zinc-50">
                        <td className="sticky left-0 z-10 h-10 border border-zinc-200 bg-white px-2 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(c.id)}
                            onChange={(e) => handleSelectOne(c.id, e.target.checked)}
                          />
                        </td>
                        <td className="h-10 border border-zinc-200 px-2 text-center">{c.category}</td>
                        <td className="sticky left-[30px] z-10 h-10 w-[120px] border border-zinc-200 bg-white px-2 text-left text-blue-700 hover:underline">
                          <Link href={`/companies/${c.id}`}>{c.company_name}</Link>
                        </td>
                        <td className="h-10 border border-zinc-200 px-2 text-center whitespace-nowrap">{c.owner_name}</td>
                        <td className="h-10 border border-zinc-200 px-2 text-center whitespace-nowrap">{c.manager_name}</td>
                        <td className="h-10 border border-zinc-200 px-2 text-center whitespace-nowrap">{c.manager_phone}</td>
                        <td className="h-10 border border-zinc-200 px-2 text-center whitespace-nowrap">{c.manager_email}</td>
                        <td className="h-10 border border-zinc-200 px-2 text-center whitespace-nowrap">{c.contact_method}</td>
                        <td className="h-10 w-[400px] border border-zinc-200 px-2 text-left break-words">
                          <textarea
                            readOnly
                            value={c.memo}
                            className="w-full cursor-pointer resize-none bg-transparent text-sm"
                            onClick={() => {
                              setSelectedMemo({ id: c.id, field: 'memo', value: c.memo || '' });
                              setModalOpen(true);
                            }}
                          />
                        </td>
                        <td className="h-10 border border-zinc-200 px-2 text-center whitespace-nowrap">{c.registration_number}</td>
                        <td className="h-10 border border-zinc-200 px-2 text-right whitespace-nowrap">{c.monthly_fee?.toLocaleString()}</td>
                        <td className="h-10 border border-zinc-200 px-2 text-center whitespace-nowrap">{c.contract_date?.slice(0, 10)}</td>
                        <td className="h-10 border border-zinc-200 px-2 text-center whitespace-nowrap">{c.business_type}</td>
                        <td className="h-10 border border-zinc-200 px-2 text-center whitespace-nowrap">{c.cms_bank_account}</td>
                        <td className="h-10 border border-zinc-200 px-2 text-center whitespace-nowrap">{c.cms_account_number}</td>
                        <td className="h-10 border border-zinc-200 px-2 text-center whitespace-nowrap">{c.cms_transfer_day}</td>
                        <td className="h-10 border border-zinc-200 px-2 text-center whitespace-nowrap">{c.is_half_term ? '예' : '아니오'}</td>
                        <td className="h-10 border border-zinc-200 px-2 text-center whitespace-nowrap">{c.salary_date}</td>
                        <td className="h-10 border border-zinc-200 px-2 text-center whitespace-nowrap">{c.salary_type}</td>
                        <td className="h-10 w-[400px] border border-zinc-200 px-2 text-left break-words">
                          <textarea
                            readOnly
                            value={c.w_memo}
                            className="w-full cursor-pointer resize-none bg-transparent text-sm"
                            onClick={() => {
                              setSelectedMemo({ id: c.id, field: 'w_memo', value: c.w_memo || '' });
                              setModalOpen(true);
                            }}
                          />
                        </td>
                        <td className="h-10 border border-zinc-200 px-2 text-center whitespace-nowrap">{c.is_online ? '예' : '아니오'}</td>
                        <td className="h-10 border border-zinc-200 px-2 text-center whitespace-nowrap">{c.is_export ? '예' : '아니오'}</td>
                        <td className="h-10 w-[400px] border border-zinc-200 px-2 text-left break-words">
                          <textarea
                            readOnly
                            value={c.v_note}
                            className="w-full cursor-pointer resize-none bg-transparent text-sm"
                            onClick={() => {
                              setSelectedMemo({ id: c.id, field: 'v_note', value: c.v_note || '' });
                              setModalOpen(true);
                            }}
                          />
                        </td>
                        <td className="h-10 w-[400px] border border-zinc-200 px-2 text-left break-words">
                          <textarea
                            readOnly
                            value={c.v_remark}
                            className="w-full cursor-pointer resize-none bg-transparent text-sm"
                            onClick={() => {
                              setSelectedMemo({ id: c.id, field: 'v_remark', value: c.v_remark || '' });
                              setModalOpen(true);
                            }}
                          />
                        </td>
                        <td className="h-10 border border-zinc-200 px-2 text-center whitespace-nowrap">{c.has_foreign_currency ? '예' : '아니오'}</td>
                        <td className="h-10 w-[400px] border border-zinc-200 px-2 text-left break-words">
                          <textarea
                            readOnly
                            value={c.ct_note}
                            className="w-full cursor-pointer resize-none bg-transparent text-sm"
                            onClick={() => {
                              setSelectedMemo({ id: c.id, field: 'ct_note', value: c.ct_note || '' });
                              setModalOpen(true);
                            }}
                          />
                        </td>
                        <td className="h-10 w-[400px] border border-zinc-200 px-2 text-left break-words">
                          <textarea
                            readOnly
                            value={c.ct_remark}
                            className="w-full cursor-pointer resize-none bg-transparent text-sm"
                            onClick={() => {
                              setSelectedMemo({ id: c.id, field: 'ct_remark', value: c.ct_remark || '' });
                              setModalOpen(true);
                            }}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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

          {selectedMemo && (
            <MemoEditModal
              open={modalOpen}
              onClose={() => setModalOpen(false)}
              initialValue={selectedMemo.value}
              title="메모 수정"
              onSave={async (newValue: string) => {
                await updateCompany(selectedMemo.id, { [selectedMemo.field]: newValue });
                toast.success('저장되었습니다.');
                setCompanies((prev) =>
                  prev.map((c) =>
                    c.id === selectedMemo.id ? { ...c, [selectedMemo.field]: newValue } : c
                  )
                );
                setModalOpen(false);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
