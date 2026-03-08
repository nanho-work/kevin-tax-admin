'use client';

import { useEffect, useState } from 'react';
import { getRoles } from '@/services/client/roleService';
import type { RoleOut } from '@/types/role';
import RoleDeleteButton from './RoleDeleteButton';
import { getRoleRank } from '@/utils/roleRank';

function statusMessage(status?: number): string {
  if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
  if (status === 403) return '직급 조회 권한이 없습니다.';
  if (status === 404) return '직급 데이터를 찾을 수 없습니다.';
  if (status && status >= 500) return '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  return '직급 목록을 불러오지 못했습니다.';
}

export default function RoleList({ adminLevel }: { adminLevel: number }) {
  const [roles, setRoles] = useState<RoleOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await getRoles();
      setRoles(data);
    } catch (error: any) {
      console.error('직급 목록 조회 실패', error);
      setErrorMessage(statusMessage(error?.response?.status));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  if (errorMessage) {
    return <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>;
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-600">
          <tr>
            <th className="px-3 py-3 text-right">ID</th>
            <th className="px-3 py-3 text-left">이름</th>
            <th className="px-3 py-3 text-right">순서</th>
            <th className="px-3 py-3 text-left">설명</th>
            <th className="px-3 py-3 text-center">삭제</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {loading ? (
            <tr>
              <td colSpan={5} className="px-3 py-10 text-center text-zinc-500">직급 목록을 불러오는 중입니다...</td>
            </tr>
          ) : roles.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-10 text-center text-zinc-500">등록된 직급이 없습니다.</td>
            </tr>
          ) : (
            roles.map((role) => {
              const rank = getRoleRank(role);
              const canDelete = rank >= 2 && (adminLevel === 0 || adminLevel === 1);
              return (
                <tr key={role.id}>
                  <td className="px-3 py-3 text-right">{role.id}</td>
                  <td className="px-3 py-3 text-left">{role.name}</td>
                  <td className="px-3 py-3 text-right">{rank}</td>
                  <td className="px-3 py-3 text-left">{role.description || '-'}</td>
                  <td className="px-3 py-3 text-center">
                    {canDelete ? (
                      <RoleDeleteButton roleId={role.id} onSuccess={fetchRoles} />
                    ) : (
                      <span className="text-xs text-zinc-400">삭제 불가</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
