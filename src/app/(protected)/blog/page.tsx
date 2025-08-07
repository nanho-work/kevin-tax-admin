'use client';

import React from 'react';

export default function BlogPage() {
  const dbDiagram = (
    <section className="bg-gray-50 border rounded p-4 mb-8">
      <h2 className="text-xl font-bold mb-3">🗂 블로그 DB 다이어그램</h2>

      <h3 className="font-semibold mb-1">1. blog_posts</h3>
      <ul className="list-disc pl-5 mb-3 text-sm">
        <li>id (INT, PK, AI): 블로그 글 고유 ID</li>
        <li>title (VARCHAR): 제목</li>
        <li>subtitle (VARCHAR): 서브타이틀</li>
        <li>summary (TEXT): 요약</li>
        <li>content (LONGTEXT): 본문 (마크다운)</li>
        <li>image (VARCHAR): 대표 이미지</li>
        <li>date (DATETIME): 게시일</li>
        <li>author (VARCHAR): 작성자</li>
        <li>category_id (INT): blog_categories의 외래키</li>
      </ul>

      <h3 className="font-semibold mb-1">2. blog_categories</h3>
      <ul className="list-disc pl-5 mb-3 text-sm">
        <li>id (INT, PK, AI): 카테고리 고유 ID</li>
        <li>name (VARCHAR): 카테고리명</li>
      </ul>

      <h3 className="font-semibold mb-1">3. blog_keywords</h3>
      <ul className="list-disc pl-5 mb-3 text-sm">
        <li>id (INT, PK, AI): 키워드 고유 ID</li>
        <li>name (VARCHAR): 키워드명</li>
      </ul>

      <h3 className="font-semibold mb-1">4. blog_post_keywords</h3>
      <ul className="list-disc pl-5 text-sm">
        <li>post_id (INT, FK): blog_posts 참조</li>
        <li>keyword_id (INT, FK): keywords 참조</li>
      </ul>
    </section>
  );

  return (
    <main className="p-6">
      {dbDiagram}
      <h1 className="text-2xl font-bold mb-4">블로그 관리</h1>
      <p className="mb-6">이곳에서 블로그 글을 작성하고, 수정하고, 삭제할 수 있습니다.</p>

      {/* 블로그 글 작성/수정 폼 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">새 글 작성</h2>
        <div className="bg-white rounded shadow p-4">
          <p>🔧 BlogForm 컴포넌트 자리</p>
        </div>
      </div>

      {/* 블로그 글 목록 출력 */}
      <div>
        <h2 className="text-xl font-semibold mb-2">블로그 글 목록</h2>
        <div className="bg-white rounded shadow p-4">
          <p>📋 BlogListTable 컴포넌트 자리</p>
        </div>
      </div>
    </main>
  );
}