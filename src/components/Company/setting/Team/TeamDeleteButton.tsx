'use client';

import { deleteTeam } from '@/services/teamService';

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
    <button onClick={handleDelete} className="text-red-500 hover:underline">
      삭제
    </button>
  );
}