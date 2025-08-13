'use client';

import { useEffect, useMemo, useState } from 'react';
import { blogService } from '@/services/blogService';
import type { BlogPostResponse } from '@/types/blog';

export default function BlogList() {
  const [rows, setRows] = useState<BlogPostResponse[]>([]);
  const [total, setTotal] = useState(0);

  // ✅ 서비스/백엔드 규격에 맞춰 page, page_size 사용
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);

    blogService
      .listPosts({ page, page_size: pageSize, q })
      .then((data) => {
        if (cancelled) return;
        setRows(data.items ?? []);
        setTotal(data.total ?? 0);

        // 응답 키가 page_size로 오면 그대로, 혹시 limit로 오는 서버면 대비
        const respPageSize = (data as any).page_size ?? (data as any).limit;
        if (respPageSize && respPageSize !== pageSize) {
          setPageSize(respPageSize);
        }
      })
      .catch((e: any) => {
        if (cancelled) return;
        setErr(e?.message || '불러오기에 실패했습니다.');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, pageSize, q]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">블로그 목록</h1>

        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder="제목/요약 검색…"
            className="border rounded px-3 py-2 text-sm w-60"
          />
          <select
            value={pageSize}
            onChange={(e) => {
              setPage(1);
              setPageSize(Number(e.target.value));
            }}
            className="border rounded px-2 py-2 text-sm"
          >
            <option value={10}>10개</option>
            <option value={20}>20개</option>
            <option value={50}>50개</option>
          </select>
        </div>
      </div>

      <div className="bg-white border rounded-md overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left font-medium px-4 py-3 w-16">ID</th>
              <th className="text-left font-medium px-4 py-3">제목</th>
              <th className="text-left font-medium px-4 py-3">카테고리</th>
              <th className="text-left font-medium px-4 py-3">상태</th>
              <th className="text-left font-medium px-4 py-3">게시일</th>
              <th className="text-left font-medium px-4 py-3">작성자</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">불러오는 중…</td>
              </tr>
            ) : err ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-red-600">{err}</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">데이터가 없습니다.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{r.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.title}</div>
                    {r.summary ? (
                      <div className="text-gray-500 text-xs line-clamp-1">{r.summary}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {/* 서버가 category 객체를 포함하면 name 우선, 없으면 id 표기 */}
                    {r.category?.name ?? (r as any).category_name ?? (r.category_id ? `#${r.category_id}` : '-')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border">
                      {r.status || 'draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.published_at ? new Date(r.published_at).toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.author_name || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-gray-700">
        <div>
          총 {total.toLocaleString()}건 / 페이지 {page} / {totalPages}
        </div>

        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 border rounded disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            이전
          </button>
          <button
            className="px-3 py-1.5 border rounded disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}