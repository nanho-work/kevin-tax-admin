'use client';

import { useEffect, useState } from 'react';
import { getDepartments } from '@/services/departmentService';
import type { DepartmentOut } from '@/types/department';
import DepartmentDeleteButton from './DepartmentDeleteButton';

export default function DepartmentList() {
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);

  const fetchData = async () => {
    const data = await getDepartments();
    setDepartments(data);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <table className="w-full border mt-4">
      <thead>
        <tr className="bg-gray-100">
          <th className="p-2 border">ID</th>
          <th className="p-2 border">이름</th>
          <th className="p-2 border">설명</th>
          <th className="p-2 border">삭제</th>
        </tr>
      </thead>
      <tbody>
        {departments.map((dept) => (
          <tr key={dept.id}>
            <td className="p-2 border">{dept.id}</td>
            <td className="p-2 border">{dept.name}</td>
            <td className="p-2 border">{dept.description}</td>
            <td className="p-2 border">
              <DepartmentDeleteButton departmentId={dept.id} onSuccess={fetchData} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}