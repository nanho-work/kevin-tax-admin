'use client';

import { deleteTeam } from '@/services/client/teamService';

export default function TeamDeleteButton({ teamId, onSuccess }: { teamId: number; onSuccess: () => void }) {
  const handleDelete = async () => {
    if (confirm('정말 삭제하시겠습니까?')) {
      try {
        await deleteTeam(teamId);
        onSuccess();
      } catch (err: any) {
        alert(err?.response?.data?.detail || '삭제 실패');
      }
    }
  };

  return (
    <button onClick={handleDelete} className="rounded border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100">
      삭제
    </button>
  );
}
