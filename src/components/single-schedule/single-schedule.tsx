'use client';

import React, { useEffect, useState } from 'react';
import { fetchSingleTaxes, updateSingleTaxStatus } from '@/services/single_scheduleService';
import { SingleTaxResponse, StatusUpdateRequest } from '@/types/single_schedule';
import SingleScheduleForm from './single-schedule-form';

const SingleSchedulePage = () => {
  const STATUS_LABELS: Record<string, string> = {
    PENDING: '대기 중',
    DONE: '완료됨',
    CANCELED: '취소됨',
  };

  const [items, setItems] = useState<SingleTaxResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchSingleTaxes(page, 10, keyword);
        setItems(data.items);
        setTotalCount(data.total);
      } catch (error) {
        console.error('단발성 일정 로딩 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [page, keyword]);

  return (
    <div>
      <h1 className="text-2xl font-bold ">단발성 일정 목록</h1>
      <div className="mb-4 flex items-start justify-between gap-4 w-full">
        {/* 검색 영역 */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="제목 또는 고객명 검색"
            className="border border-gray-300 rounded px-3 py-2 w-64"
          />
          <button
            onClick={() => setPage(1)}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            검색
          </button>
        </div>

        {/* 스케줄 폼 */}
        <div className="flex items-end">
          <SingleScheduleForm />
        </div>
      </div>
      {loading ? (
        <p>로딩 중...</p>
      ) : (
        <>
          <table className="w-full table-auto border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2">제목</th>
                <th className="border border-gray-300 px-4 py-2">고객명</th>
                <th className="border border-gray-300 px-4 py-2">스케줄 종류</th>
                <th className="border border-gray-300 px-4 py-2">기한일</th>
                <th className="border border-gray-300 px-4 py-2">메모</th>
                <th className="border border-gray-300 px-4 py-2">작성일</th>
                <th className="border border-gray-300 px-4 py-2">상태</th>
                <th className="border border-gray-300 px-4 py-2">처리일</th>
                <th className="border border-gray-300 px-4 py-2">처리 담당자</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="text-center">
                  <td className="border border-gray-300 px-4 py-2">{item.title}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.client_name}</td>

                  <td className="border border-gray-300 px-4 py-2">{item.schedule_type}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.due_date?.slice(0, 10)}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.memo}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.created_at?.slice(0, 10)}</td>
                  <td className="border border-gray-300 px-4 py-2">
                    <select
                      className="border rounded px-2 py-1"
                      value={item.status ?? 'PENDING'}
                      onChange={async (e) => {
                        const newStatus = e.target.value as StatusUpdateRequest['status'];
                        try {
                          const res = await updateSingleTaxStatus(item.id, { status: newStatus });
                          setItems((prev) =>
                            prev.map((el) => (el.id === item.id ? { ...el, status: res.status } : el))
                          );
                          window.location.reload();
                        } catch (err) {
                          alert('상태 변경에 실패했습니다.');
                          console.error(err);
                        }
                      }}
                    >
                      <option value="PENDING">대기 중</option>
                      <option value="DONE">완료됨</option>
                      <option value="CANCELED">취소됨</option>
                    </select>
                  </td>
                  <td className="border border-gray-300 px-4 py-2">{item.completed_at?.slice(0, 10) || '-'}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.status_updated_by_name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-center items-center gap-4">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              disabled={page === 1}
            >
              이전
            </button>
            <span>
              페이지 {page} / {Math.ceil(totalCount / 10) || 1}
            </span>
            <button
              onClick={() => setPage((prev) => prev + 1)}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              disabled={page * 10 >= totalCount}
            >
              다음
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default SingleSchedulePage;
