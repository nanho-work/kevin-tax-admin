'use client';

import { useEffect, useState } from 'react';
import { getRoles } from '@/services/roleService';
import type { RoleOut } from '@/types/role';
import RoleDeleteButton from './RoleDeleteButton';

export default function RoleList() {
  const [roles, setRoles] = useState<RoleOut[]>([]);

  const fetchRoles = async () => {
    const data = await getRoles();
    setRoles(data);
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  return (
    <table className="w-full border mt-4">
      <thead>
        <tr className="bg-gray-100">
          <th className="p-2 border">ID</th>
          <th className="p-2 border">이름</th>
          <th className="p-2 border">레벨</th>
          <th className="p-2 border">설명</th>
          <th className="p-2 border">삭제</th>
        </tr>
      </thead>
      <tbody>
        {roles.map((role) => (
          <tr key={role.id}>
            <td className="p-2 border">{role.id}</td>
            <td className="p-2 border">{role.name}</td>
            <td className="p-2 border">{role.level}</td>
            <td className="p-2 border">{role.description}</td>
            <td className="p-2 border">
              <RoleDeleteButton roleId={role.id} onSuccess={fetchRoles} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}