import React from 'react';
import { Editor } from '@tiptap/react';
import {
    Bold,
    Italic,
    Link as LinkIcon,
    Image as ImageIcon,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    Quote,
    Code,
} from 'lucide-react';

interface ToolbarProps {
    editor: Editor | null;
    onImageUpload?: () => void; // 이미지 업로드 핸들러
}

export const Toolbar: React.FC<ToolbarProps> = ({ editor, onImageUpload }) => {
    if (!editor) return null;

    return (
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-300 bg-white p-2">
            {/* 제목 */}
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={editor.isActive('heading', { level: 1 }) ? 'btn-active' : 'btn'}
            >
                <Heading1 size={18} />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={editor.isActive('heading', { level: 2 }) ? 'btn-active' : 'btn'}
            >
                <Heading2 size={18} />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={editor.isActive('heading', { level: 3 }) ? 'btn-active' : 'btn'}
            >
                <Heading3 size={18} />
            </button>

            {/* 굵게 / 기울임꼴 */}
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={editor.isActive('bold') ? 'btn-active' : 'btn'}
            >
                <Bold size={18} />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={editor.isActive('italic') ? 'btn-active' : 'btn'}
            >
                <Italic size={18} />
            </button>
            

            {/* 목록 */}
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={editor.isActive('bulletList') ? 'btn-active' : 'btn'}
            >
                <List size={18} />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={editor.isActive('orderedList') ? 'btn-active' : 'btn'}
            >
                <ListOrdered size={18} />
            </button>

            {/* 인용문 */}
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={editor.isActive('blockquote') ? 'btn-active' : 'btn'}
            >
                <Quote size={18} />
            </button>

            {/* 코드 */}
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                className={editor.isActive('codeBlock') ? 'btn-active' : 'btn'}
            >
                <Code size={18} />
            </button>

            {/* 링크 */}
            <button
                type="button"
                onClick={() => {
                    const url = window.prompt('링크 URL을 입력하세요');
                    if (url) {
                        editor.chain().focus().setLink({ href: url }).run();
                    }
                }}
                className={editor.isActive('link') ? 'btn-active' : 'btn'}
            >
                <LinkIcon size={18} />
            </button>

            {/* 이미지 업로드 */}
            <button
                type="button"
                onClick={onImageUpload}
                className="btn"
            >
                <ImageIcon size={18} />
            </button>
        </div>
    );
};