import { validateUploadFile } from '@/utils/fileUploadPolicy'

type UploadResult = { s3_key?: string | null }

type UploadParams = {
  files: File[]
  uploadFile: (file: File) => Promise<UploadResult>
  getErrorMessage: (error: unknown) => string
}

export async function uploadMailAttachmentsAndCollectKeys(params: UploadParams): Promise<string[]> {
  const { files, uploadFile, getErrorMessage } = params
  const keys: string[] = []

  for (const file of files) {
    const validation = validateUploadFile(file)
    if (!validation.valid) {
      throw new Error(validation.message || `${file.name}: 업로드할 수 없는 파일입니다.`)
    }
    try {
      const uploaded = await uploadFile(file)
      if (uploaded?.s3_key) keys.push(uploaded.s3_key)
    } catch (error) {
      const detailMessage = getErrorMessage(error)
      throw new Error(`${file.name}: ${detailMessage}`)
    }
  }

  return keys
}

