// app/(protected)/blog/[slug]/page.tsx
import BlogDetail from '@/components/blog/BlogDetail';
import { blogService } from '@/services/blogService';
import type { BlogPostResponse } from '@/types/blog';

// NOTE:
// Some Next.js 15 type setups constrain page props to a generic "PageProps"
// where `params` may be typed as a Promise. To avoid build-time type
// incompatibilities on Vercel, we intentionally keep the props as `any`
// and narrow inside the function. Runtime behaviour is unchanged.
export default async function BlogDetailPage(props: any) {
  const maybeParams = props?.params;
  const slug =
    maybeParams && typeof maybeParams === 'object'
      ? (maybeParams as { slug?: string }).slug
      : undefined;

  if (!slug) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">잘못된 경로입니다.</h1>
      </div>
    );
  }

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