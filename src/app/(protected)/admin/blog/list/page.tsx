
import { Suspense } from 'react'
import BlogList from '@/components/admin/blog/BlogList';

export default function BlogListPage() {
  return (
    <div className="">
      <Suspense fallback={<div className="p-4 text-sm text-zinc-500">불러오는 중...</div>}>
        <BlogList />
      </Suspense>
    </div>
  );
}
