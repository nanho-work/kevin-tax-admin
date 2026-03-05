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
            <div className="fixed inset-0 bg-black bg-opacity-30" />

            <div className="bg-white rounded shadow-md w-[600px] p-6 z-50 relative">
                <Dialog.Title className="text-lg font-semibold mb-4">{title}</Dialog.Title>

                <textarea
                    className="w-full h-40 border rounded p-2 text-sm"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                />

                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onClose} className="px-4 py-2 border rounded">닫기</button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                    >
                        {loading ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
        </Dialog>
    );
}