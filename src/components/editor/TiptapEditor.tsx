'use client';

import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { Toolbar } from './TiptapToolbar';
import {
  uploadEditorContentImageByUrl,
  uploadEditorImageFile,
} from '@/services/editorImageUploadService'


/** 내부/허용 도메인인지 판별(이미 우리 S3 등인 경우 업로드 스킵) */
function isAllowedInternalSrc(src: string): boolean {
  const s = src.toLowerCase();
  return (
    s.includes('kevintax.s3.') ||
    s.includes('thekevinstaxlab.com')
  );
}

function isDataOrBase64(src: string): boolean {
  return src.startsWith('data:');
}

function isHttpUrl(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

/** 붙여넣은 HTML의 <img> src를 S3 URL로 치환 */
async function rewriteImageSrcsToS3(html: string): Promise<string> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const imgs = Array.from(doc.querySelectorAll('img'));
  if (imgs.length === 0) return html;

  for (const img of imgs) {
    const src = img.getAttribute('src') || '';
    if (!src) continue;

    // 이미 내부/허용 도메인 또는 data URL, http 아닌 경우 → 스킵
    if (isAllowedInternalSrc(src) || isDataOrBase64(src) || !isHttpUrl(src)) continue;

    // 서버 업로드 → 성공 시 교체, 실패 시 원본 유지
    const uploaded = await uploadEditorContentImageByUrl(src);
    if (uploaded) img.setAttribute('src', uploaded);
  }

  return doc.body.innerHTML;
}

interface TiptapEditorProps {
  /** ✅ 새 권장 prop: 외부에서 제어하는 값 */
  value?: string;
  /** ⛳️ 하위호환: 기존 content prop도 허용 (value가 우선) */
  content?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  enableImageUpload?: boolean;
}

export default function TiptapEditor({
  value,
  content,
  onChange,
  placeholder = '내용을 입력하세요...',
  enableImageUpload = true,
}: TiptapEditorProps) {
  // value가 있으면 우선 사용, 없으면 content, 둘 다 없으면 빈 문자열
  const inputValue = value ?? content ?? '';
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const editor = useEditor({
    immediatelyRender: false, // SSR mismatch 방지
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: true,
        autolink: true,
        defaultProtocol: 'https',
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Table.configure({
        resizable: true,
        lastColumnResizable: true,
        allowTableNodeSelection: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: inputValue,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      /** TipTap은 동기 반환을 기대 → async 직접 사용 금지
       *  내부에서 IIFE로 비동기 실행 */
      handlePaste(view, evt) {
        const event = evt as ClipboardEvent;
        const cd = event.clipboardData;
        if (!cd) return false;

        if (!enableImageUpload) return false;

        const imageItems = Array.from(cd.items || []).filter((item) => item.type.startsWith('image/'));
        if (imageItems.length > 0) {
          event.preventDefault();
          const file = imageItems[0].getAsFile();
          if (!file) return true;

          (async () => {
            const uploaded = await uploadEditorImageFile(file);
            if (uploaded) {
              editor?.chain().focus().setImage({ src: uploaded }).run();
            }
          })();

          return true;
        }

        const html = cd.getData('text/html');
        if (!html) return false; // 평문이면 기본 동작

        // 우리가 핸들링
        event.preventDefault();

        (async () => {
          let rewritten = html;
          try {
            rewritten = await rewriteImageSrcsToS3(html);
          } catch {
            // 실패 시 원본 유지
          }
          // 치환된(또는 원본) HTML 삽입
          // @ts-ignore TipTap 명령 사용
          editor?.commands.insertContent(rewritten);
        })();

        return true; // 기본 붙여넣기 막음
      },
    },
  });

  const handleImageFileSelect = async (file: File) => {
    const uploaded = await uploadEditorImageFile(file)
    if (!uploaded) return
    editor?.chain().focus().setImage({ src: uploaded }).run()
  }

  // ✅ 외부 값(value/content) 변경 시 에디터 내용을 동기화
  useEffect(() => {
    if (!editor) return;
    const next = inputValue;
    const current = editor.getHTML();
    if (current !== next) {
      editor.commands.setContent(next, { emitUpdate: false }); // emitUpdate: false → 히스토리에 남기지 않고 onUpdate 트리거 안 함(초기화 용)
    }
  }, [editor, inputValue]);

  if (!editor) return null;

  return (
    <div className="border rounded-md">
      {/* Sticky toolbar: stays at the top while the page scrolls */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b">
        <Toolbar
          editor={editor}
          onImageUpload={enableImageUpload ? () => fileInputRef.current?.click() : undefined}
          showImageButton={enableImageUpload}
        />
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} className="min-h-[200px] p-3" />
      {enableImageUpload ? (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            if (!file) return
            await handleImageFileSelect(file)
            event.target.value = ''
          }}
        />
      ) : null}
    </div>
  );
}
