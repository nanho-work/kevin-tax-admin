import axios from 'axios'
import { getAdminAccessToken, getClientAccessToken } from '@/services/http'
import { createMultipartUploadAdapter, uploadViaAdapter } from '@/services/upload/multipartUpload'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/blog`
const uploadEditorThumbnailAdapter = createMultipartUploadAdapter<{ thumbnail_url?: string }, { file: File }>({
  url: () => `${BASE}/posts/thumbnail-upload`,
  requestConfig: () => ({
    headers: resolveAuthHeaders(),
    withCredentials: true,
  }),
})

function resolveAuthHeaders(): Record<string, string> {
  const adminToken = getAdminAccessToken()
  const clientToken = getClientAccessToken()
  const token = adminToken || clientToken
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function uploadEditorImageFile(file: File): Promise<string | null> {
  try {
    const data = await uploadViaAdapter(axios, uploadEditorThumbnailAdapter, { file })
    return data?.thumbnail_url ?? null
  } catch {
    return null
  }
}

export async function uploadEditorContentImageByUrl(imageUrl: string): Promise<string | null> {
  try {
    const res = await axios.post<{ url?: string }>(
      `${BASE}/posts/content-image-upload-by-url`,
      { url: imageUrl },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...resolveAuthHeaders(),
        },
        withCredentials: true,
      }
    )
    return res.data?.url ?? null
  } catch {
    return null
  }
}
