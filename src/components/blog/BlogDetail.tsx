// app/blog/components/BlogDetail.tsx
'use client';

import type { BlogPostResponse } from '@/types/blog';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';

// 마크다운 렌더링 컴포넌트 (예: react-markdown)
const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false });

interface BlogDetailProps {
  post: BlogPostResponse;
}

export default function BlogDetail({ post }: BlogDetailProps) {
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

      {/* 본문 (마크다운) */}
      <div className="prose max-w-none">
        <ReactMarkdown>{post.content_md}</ReactMarkdown>
      </div>

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