'use client';

import { Dialog } from '@headlessui/react';
import { useState } from 'react';
import { useEffect } from 'react';

interface MemoEditModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    initialValue: string;
    onSave: (newValue: string) => Promise<void>;
}

export default function MemoEditModal({ open, onClose, title = '메모 수정', initialValue, onSave }: MemoEditModalProps) {
    const [value, setValue] = useState(initialValue);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);


    const handleSave = async () => {
        try {
            setLoading(true);
            await onSave(value.trim());
            onClose();
        } catch (err) {
            console.error('메모 저장 실패:', err);
            alert('저장 실패');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center">
            {/* 직접 Overlay 추가 */}
            <div className="fixed inset-0 bg-black/30" />

            <div className="relative z-50 w-[600px] rounded-xl border border-zinc-200 bg-white p-6 shadow-md">
                <Dialog.Title className="mb-4 text-lg font-semibold text-zinc-900">{title}</Dialog.Title>

                <textarea
                    className="h-40 w-full rounded-lg border border-zinc-300 p-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                />

                <div className="mt-4 flex justify-end gap-2">
                    <button
                      onClick={onClose}
                      className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      닫기
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
                    >
                        {loading ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
        </Dialog>
    );
}
