'use client';

import { deleteRole } from '@/services/roleService';

export default function RoleDeleteButton({ roleId, onSuccess }: { roleId: number; onSuccess: () => void }) {
  const handleDelete = async () => {
    if (confirm('정말 삭제하시겠습니까?')) {
      await deleteRole(roleId);
      onSuccess();
    }
  };

  return (
    <button onClick={handleDelete} className="rounded border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100">
      삭제
    </button>
  );
}
