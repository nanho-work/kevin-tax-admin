'use client';

import { deleteRole } from '@/services/client/roleService';
import { toast } from 'react-hot-toast';

function statusMessage(status?: number): string {
  if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
  if (status === 403) return '권한이 없어 삭제할 수 없습니다.';
  if (status === 404) return '이미 삭제되었거나 존재하지 않는 직급입니다.';
  if (status && status >= 500) return '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  return '삭제 중 오류가 발생했습니다.';
}

export default function RoleDeleteButton({
  roleId,
  onSuccess,
  disabled,
}: {
  roleId: number;
  onSuccess: () => void;
  disabled?: boolean;
}) {
  const handleDelete = async () => {
    if (disabled) return;
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      await deleteRole(roleId);
      toast.success('삭제되었습니다.');
      onSuccess();
    } catch (err: any) {
      toast.error(statusMessage(err?.response?.status));
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={disabled}
      className="rounded border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      삭제
    </button>
  );
}
