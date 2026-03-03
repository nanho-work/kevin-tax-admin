'use client';

import { useEffect, useState } from 'react';
import { getRoles } from '@/services/roleService';
import type { RoleOut } from '@/types/role';
import RoleDeleteButton from './RoleDeleteButton';

export default function RoleList() {
  const [roles, setRoles] = useState<RoleOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await getRoles();
      setRoles(data);
    } catch (error) {
      console.error('직급 목록 조회 실패', error);
      setErrorMessage('직급 목록을 불러오지 못했습니다.');
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
            <th className="px-3 py-3 text-right">레벨</th>
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
            roles.map((role) => (
              <tr key={role.id}>
                <td className="px-3 py-3 text-right">{role.id}</td>
                <td className="px-3 py-3 text-left">{role.name}</td>
                <td className="px-3 py-3 text-right">{role.level}</td>
                <td className="px-3 py-3 text-left">{role.description || '-'}</td>
                <td className="px-3 py-3 text-center">
                  <RoleDeleteButton roleId={role.id} onSuccess={fetchRoles} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
