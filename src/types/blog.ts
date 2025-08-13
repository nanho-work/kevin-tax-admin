// src/types/blog.ts

/** ISO 8601 datetime string (e.g. "2025-08-12T03:00:00Z") */
export type ISODateString = string;

/** Pydantic v2 Literal 대응 */
export type StatusType = 'draft' | 'published' | 'archived';

/* ─────────────────────────────────────────────────────────
 * 블로그 카테고리 타입
 * ───────────────────────────────────────────────────────── */
export interface BlogCategoryBase {
  name: string;            // max_length: 100
  slug: string;            // max_length: 120
}

export interface BlogCategoryCreate extends BlogCategoryBase {}

export interface BlogCategoryUpdate {
  name?: string;           // max_length: 100
  slug?: string;           // max_length: 120
}

export interface BlogCategoryResponse extends BlogCategoryBase {
  id: number;
  created_at: ISODateString;
  updated_at: ISODateString;
}

/* ─────────────────────────────────────────────────────────
 * 키워드(태그) 타입
 * ───────────────────────────────────────────────────────── */
export interface KeywordBase {
  name: string;            // max_length: 80
  slug: string;            // max_length: 100
}

export interface KeywordCreate extends KeywordBase {}

export interface KeywordUpdate {
  name?: string;           // max_length: 80
  slug?: string;           // max_length: 100
}

export interface KeywordResponse extends KeywordBase {
  id: number;
  created_at: ISODateString;
  updated_at: ISODateString;
}

/* ─────────────────────────────────────────────────────────
 * 블로그 포스트 타입
 * ───────────────────────────────────────────────────────── */
export interface BlogPostBase {
  title: string;                   // max_length: 200
  subtitle?: string | null;        // max_length: 300
  summary?: string | null;
  content_md: string;
  thumbnail_url?: string | null;
  author_name?: string | null;     // 서버에서 세션값으로 저장될 수 있음
  category_id: number;
  slug: string;                    // max_length: 220
  status: StatusType;              // default server-side: 'draft'
  published_at?: ISODateString | null;
}

export interface BlogPostCreate extends BlogPostBase {
  /** 연관 키워드 ID 목록 (서버 기본값: []) */
  keyword_ids?: number[];
}

export interface BlogPostUpdate {
  title?: string;                  // max_length: 200
  subtitle?: string | null;        // max_length: 300
  summary?: string | null;
  content_md?: string;
  thumbnail_url?: string | null;
  author_name?: string | null;
  category_id?: number;
  slug?: string;                   // max_length: 220
  status?: StatusType;
  published_at?: ISODateString | null;
  keyword_ids?: number[];          // default server-side: []
}

export interface BlogPostResponse extends BlogPostBase {
  id: number;
  created_at: ISODateString;
  updated_at: ISODateString;
  category?: BlogCategoryResponse | null;
  keywords: KeywordResponse[];     // default: []
}

/* ─────────────────────────────────────────────────────────
 * 블로그 포스트-키워드 연결 타입
 * ───────────────────────────────────────────────────────── */
export interface BlogPostKeywordResponse {
  post_id: number;
  keyword_id: number;
  created_at: ISODateString;
  keyword?: KeywordResponse | null;
}