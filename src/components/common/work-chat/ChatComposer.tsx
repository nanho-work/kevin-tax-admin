'use client'

import { useId } from 'react'
import { Image as ImageIcon, Paperclip } from 'lucide-react'
import UiButton from '@/components/common/UiButton'

type ChatComposerProps = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onFileSelect: (file: File) => void
  onImageSelect: (file: File) => void
  sendDisabled: boolean
  uploading: boolean
  helperText?: string
  rows?: number
  isComposing?: boolean
  onCompositionStart?: () => void
  onCompositionEnd?: () => void
  onBlur?: () => void
  wrapperClassName?: string
  textareaClassName?: string
}

export default function ChatComposer({
  value,
  onChange,
  onSend,
  onFileSelect,
  onImageSelect,
  sendDisabled,
  uploading,
  helperText,
  rows = 3,
  isComposing = false,
  onCompositionStart,
  onCompositionEnd,
  onBlur,
  wrapperClassName = '',
  textareaClassName = '',
}: ChatComposerProps) {
  const fileInputId = useId()
  const imageInputId = useId()

  return (
    <div className={`border-t border-zinc-100 bg-white px-3 py-3.5 ${wrapperClassName}`.trim()}>
      <input
        id={fileInputId}
        type="file"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFileSelect(file)
          event.currentTarget.value = ''
        }}
      />
      <input
        id={imageInputId}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onImageSelect(file)
          event.currentTarget.value = ''
        }}
      />
      <div className="flex flex-col gap-2">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          onBlur={onBlur}
          placeholder="메시지를 입력하세요"
          rows={rows}
          className={`min-h-[58px] flex-1 resize-none rounded-none border-0 bg-white px-3 py-2.5 text-sm leading-5 outline-none focus:ring-0 ${textareaClassName}`.trim()}
          onKeyDown={(event) => {
            const nativeEvent = event.nativeEvent as KeyboardEvent & {
              isComposing?: boolean
              keyCode?: number
            }
            if (isComposing || nativeEvent.isComposing || nativeEvent.keyCode === 229) return
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              onSend()
            }
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <label
              htmlFor={fileInputId}
              className={`inline-flex h-7 w-7 items-center justify-center rounded bg-transparent text-zinc-700 hover:bg-zinc-100 ${uploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`.trim()}
              aria-label={uploading ? '파일 업로드 중' : '파일 첨부'}
              title={uploading ? '파일 업로드 중' : '파일 첨부'}
            >
              <Paperclip className="h-3.5 w-3.5" />
            </label>
            <label
              htmlFor={imageInputId}
              className={`inline-flex h-7 w-7 items-center justify-center rounded bg-transparent text-zinc-700 hover:bg-zinc-100 ${uploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`.trim()}
              aria-label={uploading ? '이미지 업로드 중' : '이미지 첨부'}
              title={uploading ? '이미지 업로드 중' : '이미지 첨부'}
            >
              <ImageIcon className="h-3.5 w-3.5" />
            </label>
          </div>
          <UiButton onClick={onSend} variant="primary" size="sm" disabled={sendDisabled}>
            전송
          </UiButton>
        </div>
        {helperText ? <p className="px-1 text-[11px] text-zinc-500">{helperText}</p> : null}
      </div>
    </div>
  )
}

