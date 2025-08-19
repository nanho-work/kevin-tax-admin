// app/(protected)/blog/[slug]/page.tsx
import BlogDetail from '@/components/blog/BlogDetail';
import { blogService } from '@/services/blogService';
import type { BlogPostResponse } from '@/types/blog';

export default async function BlogDetailPage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params;

  let post: BlogPostResponse | null = null;
  try {
    post = await blogService.getPostBySlug(slug);
  } catch (error) {
    console.error('블로그 상세 조회 실패:', error);
  }

  if (!post) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">포스트를 찾을 수 없습니다.</h1>
      </div>
    );
  }

  return (
    <div className="p-6">
      <BlogDetail post={post} />
    </div>
  );
}