'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { blogService } from '@/services/blogService';
import type { BlogPostResponse } from '@/types/blog';

export default function BlogList() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<BlogPostResponse[]>([]);
  const [total, setTotal] = useState(0);

  // ✅ 서비스/백엔드 규격에 맞춰 page, page_size 사용
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const categoryId = Number(searchParams.get('category') || 0) || undefined;
  const keywordId = Number(searchParams.get('keyword') || 0) || undefined;

  const loadPosts = useCallback(async (targetPage = page) => {
    setLoading(true);
    setErr(null);

    try {
      const data = await blogService.listPosts({
        page: targetPage,
        page_size: pageSize,
        q: q.trim() || undefined,
        category_id: categoryId,
        keyword_id: keywordId,
      });

      setRows(data.items ?? []);
      setTotal(data.total ?? 0);

      const respPageSize = (data as any).page_size ?? (data as any).limit;
      if (respPageSize && respPageSize !== pageSize) {
        setPageSize(respPageSize);
      }
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || '불러오기에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [categoryId, keywordId, page, pageSize, q]);

  const handleDelete = async (postId: number, title?: string) => {
    if (!window.confirm(`정말 삭제하시겠습니까?\n\n제목: ${title ?? ''}`)) return;
    try {
      setDeletingId(postId);
      await blogService.deletePost(postId);
      const nextPage = rows.length === 1 && page > 1 ? page - 1 : page;
      if (nextPage !== page) {
        setPage(nextPage);
      } else {
        await loadPosts(nextPage);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e?.message || '삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    void loadPosts(page);
  }, [loadPosts, page]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  return (
    <section className="space-y-4 p-4 md:p-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-zinc-900">블로그 목록</h2>
            <Link
              href="/client/client-management/blog/create"
              className="inline-flex h-9 items-center rounded-md bg-neutral-900 px-3 text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              글 작성
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              placeholder="제목/요약 검색"
              className="h-9 w-64 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500"
            />
            <select
              value={pageSize}
              onChange={(e) => {
                setPage(1);
                setPageSize(Number(e.target.value));
              }}
              className="h-9 rounded-md border border-zinc-300 px-2 text-sm outline-none focus:border-zinc-500"
            >
              <option value={10}>10개</option>
              <option value={20}>20개</option>
              <option value={50}>50개</option>
            </select>
          </div>
        </div>

        {categoryId || keywordId ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {categoryId ? (
              <span className="inline-flex rounded-full bg-zinc-100 px-3 py-1 text-zinc-700">
                카테고리 필터 #{categoryId}
              </span>
            ) : null}
            {keywordId ? (
              <span className="inline-flex rounded-full bg-zinc-100 px-3 py-1 text-zinc-700">
                키워드 필터 #{keywordId}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => router.replace(pathname)}
              className="rounded-md border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              필터 해제
            </button>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-600">
            <tr>
              {/* <th className="text-left font-medium px-4 py-3 w-16">ID</th> */}
              <th className="text-left font-medium px-4 py-3">카테고리</th>
              <th className="text-left font-medium px-4 py-3">제목</th>
              <th className="text-left font-medium px-4 py-3">상태</th>
              <th className="text-left font-medium px-4 py-3">게시일</th>
              <th className="text-left font-medium px-4 py-3">작성자</th>
              <th className="text-left font-medium px-4 py-3 w-24">관리</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">불러오는 중...</td>
              </tr>
            ) : err ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-rose-600">{err}</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">데이터가 없습니다.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-50">
                  {/* <td className="px-4 py-3 text-gray-500">{r.id}</td> */}
                  <td className="px-4 py-3 text-zinc-700">
                    {/* 서버가 category 객체를 포함하면 name 우선, 없으면 id 표기 */}
                    {r.category?.name ?? (r as any).category_name ?? (r.category_id ? `#${r.category_id}` : '-')}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/client/client-management/blog/${r.slug}`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {r.title}
                    </Link>
                    {r.summary ? (
                      <div className="line-clamp-1 text-xs text-zinc-500">{r.summary}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-700">
                      {r.status || 'draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {r.published_at ? new Date(r.published_at).toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{r.author_name || '-'}</td>
                  <td className="px-4 py-3">
                    <button
                      className="rounded border border-rose-300 px-2.5 py-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      onClick={() => handleDelete(r.id, r.title)}
                      disabled={deletingId === r.id || loading}
                      title="삭제"
                    >
                      {deletingId === r.id ? '삭제중…' : '삭제'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-zinc-700">
        <div className="px-1">
          총 {total.toLocaleString()}건 / 페이지 {page} / {totalPages}
        </div>

        <div className="flex items-center gap-2">
          <button
            className="rounded border border-zinc-300 px-3 py-1.5 transition hover:bg-zinc-50 disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            이전
          </button>
          <button
            className="rounded border border-zinc-300 px-3 py-1.5 transition hover:bg-zinc-50 disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >
            다음
          </button>
        </div>
      </div>
    </section>
  );
}
