'use client';

import { useEffect, useState } from 'react';
import { fetchCompanyTaxList, deactivateCompany, updateCompany as apiUpdateCompany } from '@/services/company';
import type { CompanyTaxDetail, CompanyUpdateRequest } from '@/types/admin_campany';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import MemoEditModal from '@/components/Company/MemoEditModal';

async function updateCompany(id: number, data: Partial<CompanyTaxDetail>) {
  try {
    console.log('전송할 데이터:', data);
    await apiUpdateCompany(id, data as CompanyUpdateRequest);
  } catch (error) {
    console.error('회사 정보 업데이트 실패:', error);
    throw error;
  }
}

export default function CompanyList() {
  const [companies, setCompanies] = useState<CompanyTaxDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState(''); // 개인, 법인 필터
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
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((i) => i !== id)
    );
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
      await Promise.all(selectedIds.map(id => deactivateCompany(id)));
      toast.success('삭제 완료');
      setCompanies(prev => prev.filter(c => !selectedIds.includes(c.id)));
      setSelectedIds([]);
    } catch (err) {
      console.error('삭제 실패:', err);
      toast.error('삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden">
      <div className="w-full overflow-x-auto">
        <div className="min-w-[1000px]">
          {/* 필터 UI */}
          <div className="flex w-full justify-between items-center mb-4">
            {selectedIds.length > 0 && (
              <div className="flex gap-3">
                <button
                  className="bg-red-500 text-white px-4 py-1 rounded hover:bg-red-600"
                  onClick={handleDelete}
                >
                  선택 삭제
                </button>
              </div>
            )}
            <div className="flex gap-2 ml-auto">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="회사명 또는 사업자번호"
                className="border rounded px-2 py-1"
              />
            </div>
          </div>

          <div className="w-full max-w-full overflow-x-auto">
            <div className="min-w-full overflow-x-auto">
              <table className="table-auto border border-gray-200 text-sm w-max">
                <thead className="bg-[#456bbd] text-white font-bold">
                  <tr>
                    <th rowSpan={2} className="border border-gray-200 px-2 py-1 h-10 text-center font-medium text-[13px] bg-[#456bbd]">
                      <input
                        type="checkbox"
                        onChange={handleSelectAll}
                        checked={selectedIds.length === companies.length && companies.length > 0}
                      />
                    </th>
                    <th colSpan={17} className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">기본사항</th>
                    <th colSpan={4} className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">원천세</th>
                    <th colSpan={4} className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">부가세</th>
                    <th colSpan={3} className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">법인세/종소세</th>
                  </tr>
                  <tr>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">구분</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">회사명</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">대표자</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">담당자</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">연락처</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">이메일</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">연락방법</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">메모</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">사업자등록번호</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">기장료</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">홈택스 ID</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">홈택스 PW</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">수임일</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">종목</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">CMS 통장</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">CMS 계좌</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">CMS 이체일</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">반기</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">급여일</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">급여작성</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">원천세 메모</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">온라인</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">수출</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">부가세 메모</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">부가세 비고</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">외화</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">법인세 메모</th>
                    <th className="border border-gray-200 px-2 py-1 h-10 text-center whitespace-nowrap">법인세 비고</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c, idx) => (
                    <tr key={c.id} className="even:bg-gray-50">
                      <td className="sticky left-0 z-10 bg-white border border-gray-200 px-2 h-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(c.id)}
                          onChange={(e) => handleSelectOne(c.id, e.target.checked)}
                        />
                      </td>
                      <td className="border border-gray-200 px-2 h-10 text-center">{c.category}</td>
                      <td className="sticky left-[30px] z-10 bg-white border border-gray-200 px-2 h-10 text-center w-[120px] text-blue-600 hover:underline">
                        <Link href={`/companies/${c.id}`}>
                          {c.company_name}
                        </Link>
                      </td>
                      <td className="border border-gray-200 px-2 h-10 text-center whitespace-nowrap">{c.owner_name}</td>
                      <td className="border border-gray-200 px-2 h-10 text-center whitespace-nowrap">{c.manager_name}</td>
                      <td className="border border-gray-200 px-2 h-10 text-center whitespace-nowrap">{c.manager_phone}</td>
                      <td className="border border-gray-200 px-2 h-10 text-center whitespace-nowrap">{c.manager_email}</td>
                      <td className="border border-gray-200 px-2 h-10 text-center whitespace-nowrap">{c.contact_method}</td>
                      <td className="border border-gray-200 px-2 h-10 text-center break-words w-[400px]">
                        <textarea
                          readOnly
                          value={c.memo}
                          className="w-full text-sm resize-none cursor-pointer"
                          onClick={() => {
                            setSelectedMemo({ id: c.id, field: 'memo', value: c.memo || '' });
                            setModalOpen(true);
                          }}
                        />
                      </td>
                      <td className="border border-gray-200 px-2 h-10 text-center whitespace-nowrap">{c.registration_number}</td>
                      <td className="border border-gray-200 px-2 h-10 text-center whitespace-nowrap">{c.monthly_fee?.toLocaleString()}</td>
                      <td className="border border-gray-200 px-2 h-10 text-center whitespace-nowrap">{c.encrypted_hometax_id}</td>
                      <td className="border border-gray-200 px-2 h-10 text-center whitespace-nowrap">{c.encrypted_hometax_pw}</td>
                      <td className="border border-gray-200 px-2 h-10 text-center whitespace-nowrap">{c.contract_date?.slice(0, 10)}</td>
                      <td className="border border-gray-200 px-2 h-10 text-center whitespace-nowrap">{c.business_type}</td>
                      <td className="border border-gray-200 px-2 h-10 text-center whitespace-nowrap">{c.cms_bank_account}</td>
                      <td className="border border-gray-200 px-2 h-10 text-center whitespace-nowrap">{c.cms_account_number}</td>
                      <td className="border border-gray-200 px-2 h-10 text-center whitespace-nowrap">{c.cms_transfer_day}</td>
                      <td className="border border-gray-200 px-2 h-10 text-center whitespace-nowrap">{c.is_half_term ? '예' : '아니오'}</td>
                      <td className="border border-gray-200 px-2 h-10 text-center whitespace-nowrap">{c.salary_date}</td>
                      <td className="border border-gray-200 px-2 h-10 text-center whitespace-nowrap">{c.salary_type}</td>
                      <td className="border border-gray-200 px-2 h-10 text-center break-words w-[400px]">
                        <textarea
                          readOnly
                          value={c.w_memo}
                          className="w-full text-sm resize-none cursor-pointer"
                          onClick={() => {
                            setSelectedMemo({ id: c.id, field: 'w_memo', value: c.w_memo || '' });
                            setModalOpen(true);
                          }}
                        />
                      </td>
                      <td className="border border-gray-200 px-2 h-10 text-center whitespace-nowrap">{c.is_online ? '예' : '아니오'}</td>
                      <td className="border border-gray-200 px-2 h-10 text-center whitespace-nowrap">{c.is_export ? '예' : '아니오'}</td>
                      <td className="border border-gray-200 px-2 h-10 text-center break-words w-[400px]">
                        <textarea
                          readOnly
                          value={c.v_note}
                          className="w-full text-sm resize-none cursor-pointer"
                          onClick={() => {
                            setSelectedMemo({ id: c.id, field: 'v_note', value: c.v_note || '' });
                            setModalOpen(true);
                          }}
                        />
                      </td>
                      <td className="border border-gray-200 px-2 h-10 text-center break-words w-[400px]">
                        <textarea
                          readOnly
                          value={c.v_remark}
                          className="w-full text-sm resize-none cursor-pointer"
                          onClick={() => {
                            setSelectedMemo({ id: c.id, field: 'v_remark', value: c.v_remark || '' });
                            setModalOpen(true);
                          }}
                        />
                      </td>
                      <td className="border border-gray-200 px-2 h-10 text-center whitespace-nowrap">{c.has_foreign_currency ? '예' : '아니오'}</td>
                      <td className="border border-gray-200 px-2 h-10 text-center break-words w-[400px]">
                        <textarea
                          readOnly
                          value={c.ct_note}
                          className="w-full text-sm resize-none cursor-pointer"
                          onClick={() => {
                            setSelectedMemo({ id: c.id, field: 'ct_note', value: c.ct_note || '' });
                            setModalOpen(true);
                          }}
                        />
                      </td>
                      <td className="border border-gray-200 px-2 h-10 text-center break-words w-[400px]">
                        <textarea
                          readOnly
                          value={c.ct_remark}
                          className="w-full text-sm resize-none cursor-pointer"
                          onClick={() => {
                            setSelectedMemo({ id: c.id, field: 'ct_remark', value: c.ct_remark || '' });
                            setModalOpen(true);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* 페이지 네비게이션 */}
          <div className="mt-4 flex justify-center items-center gap-2 text-sm">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
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
                    className={`px-3 py-1 rounded border ${p === page ? 'bg-blue-600 text-white font-semibold' : 'bg-white hover:bg-gray-100'}`}
                  >
                    {p}
                  </button>
                );
              })}

            <button
              onClick={() => setPage((prev) => Math.min(Math.ceil(totalCount / pageSize), prev + 1))}
              disabled={page === Math.ceil(totalCount / pageSize)}
              className="px-3 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
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
                setCompanies(prev =>
                  prev.map(c =>
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