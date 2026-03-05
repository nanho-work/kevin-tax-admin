// app/blog/components/BlogDetail.tsx

'use client';

import { useMemo } from 'react';
import DOMPurify from 'isomorphic-dompurify';

import type { BlogPostResponse } from '@/types/blog';
import Image from 'next/image';
import Link from 'next/link';

interface BlogDetailProps {
  post: BlogPostResponse;
}

export default function BlogDetail({ post }: BlogDetailProps) {
  const safeHtml = useMemo(() => {
    const raw = post.content_md ?? '';
    // allow style/target/rel since your saved HTML includes inline styles and external links
    return DOMPurify.sanitize(raw, {
      ADD_ATTR: ['style', 'target', 'rel'],
    });
  }, [post.content_md]);
  return (
    <article className="max-w-4xl mx-auto">
      {/* 카테고리 */}
      {post.category && (
        <div className="text-sm text-blue-600 mb-2">
          <Link href={`/blog?category=${post.category.id}`}>
            {post.category.name}
          </Link>
        </div>
      )}

      {/* 제목 */}
      <h1 className="text-3xl font-bold mb-2">{post.title}</h1>

      {/* 부제목 */}
      {post.subtitle && (
        <h2 className="text-lg text-gray-600 mb-4">{post.subtitle}</h2>
      )}

      {/* 작성자 / 작성일 */}
      <div className="text-sm text-gray-500 mb-6">
        {post.author_name} ·{' '}
        {post.published_at
          ? new Date(post.published_at).toLocaleDateString()
          : new Date(post.created_at).toLocaleDateString()}
      </div>

      {/* 썸네일 */}
      {post.thumbnail_url && (
        <div className="mb-6">
          <Image
            src={post.thumbnail_url}
            alt={post.title}
            width={800}
            height={400}
            className="rounded-md object-cover"
          />
        </div>
      )}

      {/* 본문 (HTML) */}
      <div
        className="prose max-w-none prose-img:rounded-md prose-a:text-blue-600 hover:prose-a:underline"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />

      {/* 키워드 */}
      {post.keywords && post.keywords.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2">
          {post.keywords.map((kw) => (
            <Link
              key={kw.id}
              href={`/blog?keyword=${kw.id}`}
              className="px-3 py-1 bg-gray-100 rounded-full text-sm hover:bg-gray-200"
            >
              #{kw.name}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}