// app/blog/[slug]/page.tsx
import { blogService } from '@/services/blogService';
import type { BlogPostResponse } from '@/types/blog';
import BlogDetail from '@/components/blog/BlogDetail';

interface BlogDetailPageProps {
  params: {
    slug: string;
  };
}

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { slug } = await params; // ✅ Next.js 15 대응

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
    <div className="p-6 max-w-4xl mx-auto">
      {/* BlogDetail 컴포넌트에 데이터 전달 */}
      <BlogDetail post={post} />
    </div>
  );
}