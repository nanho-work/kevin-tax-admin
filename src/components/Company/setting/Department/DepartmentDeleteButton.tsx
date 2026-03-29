'use client';

import { deleteDepartment } from '@/services/departmentService';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext'
import { toast } from 'react-hot-toast'
import { getApiErrorMessage } from '@/utils/apiError'

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
      toast.error(getApiErrorMessage(err, '삭제 실패'));
    }
  };

  return (
    <button onClick={handleDelete} className="text-red-500 hover:underline">
      삭제
    </button>
  );
}
