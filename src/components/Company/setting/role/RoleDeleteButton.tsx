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
    <button onClick={handleDelete} className="text-red-500 hover:underline">
      삭제
    </button>
  );
}