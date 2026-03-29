'use client';

import { deleteRole } from '@/services/roleService';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext'

export default function RoleDeleteButton({ roleId, onSuccess }: { roleId: number; onSuccess: () => void }) {
  const { confirm } = useConfirmDialog()
  const handleDelete = async () => {
    const ok = await confirm({
      title: '직급 삭제',
      description: '정말 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'danger',
    })
    if (!ok) return
    await deleteRole(roleId);
    onSuccess();
  };

  return (
    <button onClick={handleDelete} className="text-red-500 hover:underline">
      삭제
    </button>
  );
}
