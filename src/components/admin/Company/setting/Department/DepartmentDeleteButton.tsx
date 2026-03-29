'use client';

import { deleteDepartment } from '@/services/client/departmentService';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext'
import { toast } from 'react-hot-toast'

export default function DepartmentDeleteButton({ departmentId, onSuccess }: { departmentId: number; onSuccess: () => void }) {
  const { confirm } = useConfirmDialog()
  const handleDelete = async () => {
    const ok = await confirm({
      title: '부서 삭제',
      description: '정말 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await deleteDepartment(departmentId);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '삭제 실패');
    }
  };

  return (
    <button onClick={handleDelete} className="rounded border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100">
      삭제
    </button>
  );
}
