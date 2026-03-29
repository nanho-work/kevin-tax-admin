'use client';

import { deleteTeam } from '@/services/client/teamService';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext'
import { toast } from 'react-hot-toast'
import { getApiErrorMessage } from '@/utils/apiError'

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
      toast.error(getApiErrorMessage(err, '삭제 실패'));
    }
  };

  return (
    <button onClick={handleDelete} className="rounded border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100">
      삭제
    </button>
  );
}
