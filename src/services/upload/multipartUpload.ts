import type { AxiosInstance, AxiosRequestConfig } from 'axios'

type UploadPrimitive = string | number | boolean
type UploadFieldValue = UploadPrimitive | Blob | File | null | undefined

function isBlobLike(value: UploadFieldValue): value is Blob {
  return typeof value === 'object' && value != null && (value as any) instanceof Blob
}

export type MultipartUploadContext = {
  file: File
  [key: string]: unknown
}

export type MultipartUploadAdapter<TResponse, TContext extends MultipartUploadContext> = {
  url: (context: TContext) => string
  method?: 'post' | 'put' | 'patch'
  fileFieldName?: string
  buildFields?: (context: TContext) => Record<string, UploadFieldValue>
  requestConfig?: (context: TContext) => AxiosRequestConfig
  responseMapper?: (raw: any, context: TContext) => TResponse
}

export function createMultipartUploadAdapter<TResponse, TContext extends MultipartUploadContext>(
  adapter: MultipartUploadAdapter<TResponse, TContext>
): MultipartUploadAdapter<TResponse, TContext> {
  return adapter
}

export async function uploadViaAdapter<TResponse, TContext extends MultipartUploadContext>(
  httpClient: AxiosInstance,
  adapter: MultipartUploadAdapter<TResponse, TContext>,
  context: TContext
): Promise<TResponse> {
  const form = new FormData()
  form.append(adapter.fileFieldName ?? 'file', context.file)

  const fields = adapter.buildFields?.(context)
  if (fields) {
    Object.entries(fields).forEach(([key, value]) => {
      if (value == null) return
      if (isBlobLike(value)) {
        form.append(key, value)
        return
      }
      form.append(key, String(value))
    })
  }

  const requestConfig = adapter.requestConfig?.(context) ?? {}
  const method = adapter.method ?? 'post'
  const res = await httpClient.request({
    method,
    url: adapter.url(context),
    data: form,
    ...requestConfig,
    headers: {
      ...(requestConfig.headers ?? {}),
      'Content-Type': 'multipart/form-data',
    },
  })

  if (adapter.responseMapper) {
    return adapter.responseMapper(res.data, context)
  }
  return res.data as TResponse
}
