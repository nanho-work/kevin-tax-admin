'use client';

import { deleteTeam } from '@/services/teamService';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext'
import { toast } from 'react-hot-toast'

export default function TeamDeleteButton({ teamId, onSuccess }: { teamId: number; onSuccess: () => void }) {
  const { confirm } = useConfirmDialog()
  const handleDelete = async () => {
    const ok = await confirm({
      title: '팀 삭제',
      description: '정말 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await deleteTeam(teamId);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '삭제 실패');
    }
  };

  return (
    <button onClick={handleDelete} className="text-red-500 hover:underline">
      삭제
    </button>
  );
}
