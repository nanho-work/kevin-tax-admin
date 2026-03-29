import { useCallback, useState } from 'react'
import { toast } from 'react-hot-toast'
import { validateUploadFile } from '@/utils/fileUploadPolicy'

type AppendInput = FileList | File[] | null | undefined

export function useMailAttachmentFiles() {
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([])

  const appendAttachmentFiles = useCallback((files: AppendInput) => {
    if (!files || (Array.isArray(files) && files.length === 0) || (!Array.isArray(files) && files.length === 0)) return

    const invalidMessages: string[] = []
    const incoming = Array.isArray(files) ? files : Array.from(files)

    setAttachmentFiles((prev) => {
      const next = [...prev]
      const existing = new Set(prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`))
      for (const file of incoming) {
        const validation = validateUploadFile(file)
        if (!validation.valid) {
          if (validation.message) invalidMessages.push(validation.message)
          continue
        }
        const key = `${file.name}-${file.size}-${file.lastModified}`
        if (existing.has(key)) continue
        existing.add(key)
        next.push(file)
      }
      return next
    })

    if (invalidMessages.length > 0) {
      const [firstMessage] = invalidMessages
      const suffix = invalidMessages.length > 1 ? ` 외 ${invalidMessages.length - 1}건` : ''
      toast.error(`${firstMessage}${suffix}`)
    }
  }, [])

  const removeAttachmentFile = useCallback((index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, idx) => idx !== index))
  }, [])

  const clearAttachmentFiles = useCallback(() => {
    setAttachmentFiles([])
  }, [])

  return {
    attachmentFiles,
    appendAttachmentFiles,
    removeAttachmentFile,
    clearAttachmentFiles,
  }
}

