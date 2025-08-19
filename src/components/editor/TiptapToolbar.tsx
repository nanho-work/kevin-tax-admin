import React from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold, Italic, Strikethrough, Underline,
  Heading as HeadingIcon,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Quote, Code,
  Link as LinkIcon, Image as ImageIcon,
  Undo2, Redo2
} from 'lucide-react';

import { IconTable, IconTableOff, IconRowInsertBottom, IconRowInsertTop, IconRowRemove, IconColumnInsertRight, IconColumnRemove } from "@tabler/icons-react";
import '@tiptap/extension-text-align'; // 정렬 커맨드 타입 보강
// ⬇️ 타입 보강을 위한 사이드이펙트 임포트 (커맨드 시그니처 추가)
import '@tiptap/extension-link';
import '@tiptap/extension-image';
import '@tiptap/extension-table';
import '@tiptap/extension-table-row';
import '@tiptap/extension-table-header';
import '@tiptap/extension-table-cell';

interface ToolbarProps {
  editor: Editor | null;
  onImageUpload?: () => void;
  sticky?: boolean; // 상단 고정 옵션
}

const Separator = () => <span className="mx-2 h-5 w-px bg-gray-300" />;

export const Toolbar: React.FC<ToolbarProps> = ({ editor, onImageUpload, sticky }) => {
  if (!editor) return null;

  const setHeading = (level: 0 | 1 | 2 | 3) => {
    if (level === 0) {
      // 본문(=paragraph)로 되돌리기
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level }).run();
    }
  };

  const cls = (active: boolean) =>
    active
      ? 'btn-active bg-gray-200 border border-gray-300'
      : 'btn hover:bg-gray-100';

  const canWorkOnTable = () => editor.isActive('table')
  const insertDefaultTable = () =>
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()

  return (
    <div
      className={[
        'flex flex-wrap items-center gap-2 border-b border-gray-300 bg-white p-2',
        'overflow-x-auto',
        sticky ? 'sticky top-0 z-10' : '',
      ].join(' ')}
      role="toolbar"
      aria-label="텍스트 편집 도구 모음"
    >
      {/* Undo / Redo */}
      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        className="btn"
        title="되돌리기 (⌘/Ctrl+Z)"
        aria-label="되돌리기"
      >
        <Undo2 size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        className="btn"
        title="다시하기 (⌘/Ctrl+Shift+Z)"
        aria-label="다시하기"
      >
        <Redo2 size={18} />
      </button>

      <Separator />

      {/* Heading Select */}
      <label className="inline-flex items-center gap-1 text-sm text-gray-600" title="제목 수준">
        <HeadingIcon size={16} />
        <select
          className="border rounded px-2 py-1 text-sm"
          value={
            editor.isActive('heading', { level: 1 }) ? 1 :
            editor.isActive('heading', { level: 2 }) ? 2 :
            editor.isActive('heading', { level: 3 }) ? 3 : 0
          }
          onChange={(e) => setHeading(Number(e.target.value) as 0 | 1 | 2 | 3)}
          aria-label="제목 수준 선택"
        >
          <option value={0}>본문</option>
          <option value={1}>제목 1</option>
          <option value={2}>제목 2</option>
          <option value={3}>제목 3</option>
        </select>
      </label>

      <Separator />

      {/* 서식 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={cls(editor.isActive('bold'))}
        aria-pressed={editor.isActive('bold')}
        title="굵게 (⌘/Ctrl+B)"
        aria-label="굵게"
      >
        <Bold size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={cls(editor.isActive('italic'))}
        aria-pressed={editor.isActive('italic')}
        title="기울임 (⌘/Ctrl+I)"
        aria-label="기울임"
      >
        <Italic size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={cls(editor.isActive('underline'))}
        aria-pressed={editor.isActive('underline')}
        title="밑줄"
        aria-label="밑줄"
      >
        <Underline size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={cls(editor.isActive('strike'))}
        aria-pressed={editor.isActive('strike')}
        title="취소선"
        aria-label="취소선"
      >
        <Strikethrough size={18} />
      </button>

      <Separator />

      {/* 정렬 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        className={cls(editor.isActive({ textAlign: 'left' }))}
        aria-pressed={editor.isActive({ textAlign: 'left' })}
        title="왼쪽 정렬"
        aria-label="왼쪽 정렬"
      >
        <AlignLeft size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        className={cls(editor.isActive({ textAlign: 'center' }))}
        aria-pressed={editor.isActive({ textAlign: 'center' })}
        title="가운데 정렬"
        aria-label="가운데 정렬"
      >
        <AlignCenter size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        className={cls(editor.isActive({ textAlign: 'right' }))}
        aria-pressed={editor.isActive({ textAlign: 'right' })}
        title="오른쪽 정렬"
        aria-label="오른쪽 정렬"
      >
        <AlignRight size={18} />
      </button>

      <Separator />

      {/* 목록 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={cls(editor.isActive('bulletList'))}
        aria-pressed={editor.isActive('bulletList')}
        title="글머리 기호"
        aria-label="글머리 기호"
      >
        <List size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={cls(editor.isActive('orderedList'))}
        aria-pressed={editor.isActive('orderedList')}
        title="번호 매기기"
        aria-label="번호 매기기"
      >
        <ListOrdered size={18} />
      </button>

      <Separator />

      {/* 인용 / 코드 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={cls(editor.isActive('blockquote'))}
        aria-pressed={editor.isActive('blockquote')}
        title="인용문"
        aria-label="인용문"
      >
        <Quote size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={cls(editor.isActive('codeBlock'))}
        aria-pressed={editor.isActive('codeBlock')}
        title="코드 블록"
        aria-label="코드 블록"
      >
        <Code size={18} />
      </button>

      <Separator />

      {/* 표(Table) */}
      <button
        type="button"
        onClick={insertDefaultTable}
        className="btn hover:bg-gray-100"
        title="표 삽입 (3x3)"
        aria-label="표 삽입"
      >
        <IconTable size={18} />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().addRowAfter().run()}
        className="btn hover:bg-gray-100"
        disabled={!canWorkOnTable()}
        title="아래에 행 추가"
        aria-label="행 추가"
      >
        <IconRowInsertBottom size={18} />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().addColumnAfter().run()}
        className="btn hover:bg-gray-100"
        disabled={!canWorkOnTable()}
        title="오른쪽에 열 추가"
        aria-label="열 추가"
      >
        <IconColumnInsertRight size={18} />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().deleteRow().run()}
        className="btn hover:bg-gray-100"
        disabled={!canWorkOnTable()}
        title="현재 행 삭제"
        aria-label="행 삭제"
      >
        <IconRowRemove size={18} />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().deleteColumn().run()}
        className="btn hover:bg-gray-100"
        disabled={!canWorkOnTable()}
        title="현재 열 삭제"
        aria-label="열 삭제"
      >
        <IconColumnRemove size={18} />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().deleteTable().run()}
        className="btn hover:bg-gray-100"
        disabled={!canWorkOnTable()}
        title="표 삭제"
        aria-label="표 삭제"
      >
        <IconTableOff size={18} />
      </button>

      <Separator />

      {/* 링크 / 이미지 */}
      <button
        type="button"
        onClick={() => {
          const url = window.prompt('링크 URL을 입력하세요');
          if (!url) {
            editor.chain().focus().unsetLink().run();
          } else {
            editor.chain().focus().setLink({ href: url }).run();
          }
        }}
        className={cls(editor.isActive('link'))}
        aria-pressed={editor.isActive('link')}
        title="링크 (선택/해제)"
        aria-label="링크"
      >
        <LinkIcon size={18} />
      </button>

      <button
        type="button"
        onClick={onImageUpload}
        className="btn hover:bg-gray-100"
        title="이미지 삽입"
        aria-label="이미지 삽입"
      >
        <ImageIcon size={18} />
      </button>
    </div>
  );
};