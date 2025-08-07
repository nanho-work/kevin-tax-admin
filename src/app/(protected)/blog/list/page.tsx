
import BlogList from '@/components/blog/BlogList';

export default function BlogListPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">블로그 글 목록</h1>
      <BlogList />
    </div>
  );
}