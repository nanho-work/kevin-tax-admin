'use client'

import type { ChangeEvent, RefObject } from 'react'
import FileDropzone from '@/components/common/FileDropzone'
import { formatFileSize } from '@/utils/mailCompose'

type MailAttachmentComposerProps = {
  files: File[]
  inputRef: RefObject<HTMLInputElement>
  onFilesDrop: (files: FileList | File[]) => void
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void
  onRemoveFile: (index: number) => void
  disabled?: boolean
}

export default function MailAttachmentComposer({
  files,
  inputRef,
  onFilesDrop,
  onInputChange,
  onRemoveFile,
  disabled = false,
}: MailAttachmentComposerProps) {
  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={onInputChange}
      />
      <div className="flex flex-wrap items-stretch gap-2">
        <FileDropzone
          onFilesDrop={onFilesDrop}
          className="flex min-h-9 min-w-[240px] flex-1 items-center rounded-md border border-dashed px-3 text-xs transition"
          idleClassName="border-zinc-300 bg-white text-zinc-500"
          activeClassName="border-zinc-500 bg-zinc-50 text-zinc-800"
        >
          파일 드래그
        </FileDropzone>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          파일첨부
        </button>
        {files.length > 0 ? (
          <span className="flex h-9 items-center text-xs text-zinc-600">{files.length}개 선택됨</span>
        ) : null}
      </div>
      {files.length > 0 ? (
        <ul className="space-y-1">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              className="flex items-center justify-between rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-800">{file.name}</p>
                <p className="text-zinc-500">{formatFileSize(file.size)}</p>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemoveFile(index)}
                className="ml-2 rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                제거
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
