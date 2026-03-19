// src/services/blogService.ts
import { clientHttp } from '@/services/http'
import { createMultipartUploadAdapter, uploadViaAdapter } from '@/services/upload/multipartUpload'
import type {
  BlogPostCreate, BlogPostResponse,
  BlogCategoryCreate, BlogCategoryResponse,
  KeywordCreate, KeywordResponse,
} from "../types/blog";

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/blog`;
const uploadBlogThumbnailAdapter = createMultipartUploadAdapter<{ thumbnail_url: string }, { file: File }>({
  url: () => `${BASE}/posts/thumbnail-upload`,
})

// -------------------------- 게시글 --------------------------
/** 목록 조회 (페이지네이션+필터) */
export async function listPosts(params: {
  page?: number;
  page_size?: number;
  category_id?: number;
  keyword_id?: number;
  status?: "draft" | "published" | "archived";
  q?: string;
} = {}): Promise<Paginated<BlogPostResponse>> {
  const res = await clientHttp.get(`${BASE}/posts`, { params });
  return res.data as Paginated<BlogPostResponse>;
}

/** 슬러그로 단건 조회 */
export async function getPostBySlug(slug: string): Promise<BlogPostResponse> {
  const res = await clientHttp.get(`${BASE}/posts/slug/${encodeURIComponent(slug)}`);
  return res.data as BlogPostResponse;
}

/** ID로 단건 조회 */
export async function getPostById(postId: number): Promise<BlogPostResponse> {
  const res = await clientHttp.get(`${BASE}/posts/${postId}`);
  return res.data as BlogPostResponse;
}

/** 생성 (keyword_ids 포함 가능) */
export async function createPost(data: BlogPostCreate): Promise<BlogPostResponse> {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const res = await clientHttp.post(`${BASE}/posts`, data, { headers });
  return res.data as BlogPostResponse;
}

/** 삭제 */
export async function deletePost(postId: number): Promise<void> {
  await clientHttp.delete(`${BASE}/posts/${postId}`);
}

// ----------------------- 카테고리 ------------------------
export async function listCategories(): Promise<BlogCategoryResponse[]> {
  const res = await clientHttp.get(`${BASE}/categories`);
  return res.data as BlogCategoryResponse[];
}

export async function createCategory(payload: BlogCategoryCreate): Promise<BlogCategoryResponse> {
  const res = await clientHttp.post(`${BASE}/categories`, payload);
  return res.data as BlogCategoryResponse;
}

export async function deleteCategory(categoryId: number): Promise<void> {
  await clientHttp.delete(`${BASE}/categories/${categoryId}`);
}

// ------------------------- 키워드 ------------------------
export async function listKeywords(): Promise<KeywordResponse[]> {
  const res = await clientHttp.get(`${BASE}/keywords`);
  return res.data as KeywordResponse[];
}

export async function createKeyword(payload: KeywordCreate): Promise<KeywordResponse> {
  const res = await clientHttp.post(`${BASE}/keywords`, payload);
  return res.data as KeywordResponse;
}

export async function deleteKeyword(keywordId: number): Promise<void> {
  await clientHttp.delete(`${BASE}/keywords/${keywordId}`);
}

// ---------------------- 이미지 유틸 --------------------
/** 썸네일 업로드 → { thumbnail_url } 반환 */
export async function uploadThumbnail(file: File): Promise<{ thumbnail_url: string }> {
  return uploadViaAdapter(clientHttp, uploadBlogThumbnailAdapter, { file });
}

/** 본문/썸네일 이미지 URL로 삭제 (백엔드가 form-data image_urls[] 받는 경우) */
export async function deleteBodyImages(
  imageUrls: string[]
): Promise<{ message: string }> {
  const fd = new FormData();
  imageUrls.forEach((u) => fd.append("image_urls", u));
  // axios delete 본문은 config.data로 전달
  const res = await clientHttp.delete(`${BASE}/posts/image-delete`, {
    data: fd,
  });
  return res.data as { message: string };
}

/** ✅ 본문 이미지 업로드(외부 URL → 서버 다운로드 → S3) */
export interface UploadByUrlResponse {
  url: string; // S3에 업로드된 최종 URL
}

export async function uploadContentImageByUrl(
  imageUrl: string
): Promise<UploadByUrlResponse> {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const res = await clientHttp.post(
    `${BASE}/posts/content-image-upload-by-url`,
    { url: imageUrl },
    { headers }
  );
  return res.data as UploadByUrlResponse;
}

export const blogService = {
  listPosts,
  getPostBySlug,
  getPostById,
  createPost,
  deletePost,
  listCategories,
  createCategory,
  deleteCategory,
  listKeywords,
  createKeyword,
  deleteKeyword,
  uploadThumbnail,
  deleteBodyImages,
  uploadContentImageByUrl, // ← 추가
};
