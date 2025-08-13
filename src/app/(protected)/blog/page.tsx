'use client';

import React from 'react';

export default function BlogPage() {
  const dbDiagram = (
    <section className="bg-gray-50 border rounded p-4 mb-8">
      <h2 className="text-xl font-bold mb-3">🗂 블로그 DB 다이어그램</h2>

      <h3 className="font-semibold mb-1">1. blog_posts</h3>
      <pre className="bg-gray-100 p-3 rounded overflow-x-auto text-xs">{`CREATE TABLE blog_posts (
  id INT PRIMARY KEY AUTO_INCREMENT, -- 글 고유 ID
  title VARCHAR(255), -- 글 제목
  subtitle VARCHAR(255), -- 글 부제목
  summary TEXT, -- 글 요약
  content LONGTEXT, -- 글 내용
  image VARCHAR(255), -- 대표 이미지 경로
  date DATETIME, -- 작성 날짜
  author VARCHAR(255), -- 작성자 이름
  category_id INT, -- 카테고리 ID
  FOREIGN KEY (category_id) REFERENCES blog_categories(id)
);`}</pre>

      <h3 className="font-semibold mb-1">2. blog_categories</h3>
      <pre className="bg-gray-100 p-3 rounded overflow-x-auto text-xs">{`CREATE TABLE blog_categories (
  id INT PRIMARY KEY AUTO_INCREMENT, -- 카테고리 고유 ID
  name VARCHAR(255) -- 카테고리 이름
);`}</pre>

      <h3 className="font-semibold mb-1">3. blog_keywords</h3>
      <pre className="bg-gray-100 p-3 rounded overflow-x-auto text-xs">{`CREATE TABLE blog_keywords (
  id INT PRIMARY KEY AUTO_INCREMENT, -- 키워드 고유 ID
  name VARCHAR(255) -- 키워드 이름
);`}</pre>

      <h3 className="font-semibold mb-1">4. blog_post_keywords</h3>
      <pre className="bg-gray-100 p-3 rounded overflow-x-auto text-xs">{`CREATE TABLE blog_post_keywords (
  post_id INT, -- 글 ID
  keyword_id INT, -- 키워드 ID
  FOREIGN KEY (post_id) REFERENCES blog_posts(id),
  FOREIGN KEY (keyword_id) REFERENCES blog_keywords(id)
);`}</pre>
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