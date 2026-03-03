'use client';

import { useEffect, useState } from 'react';
import { getDepartments } from '@/services/departmentService';
import type { DepartmentOut } from '@/types/department';
import DepartmentDeleteButton from './DepartmentDeleteButton';

export default function DepartmentList() {
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await getDepartments();
      setDepartments(data);
    } catch (error) {
      console.error('부서 목록 조회 실패', error);
      setErrorMessage('부서 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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
            <th className="px-3 py-3 text-left">설명</th>
            <th className="px-3 py-3 text-center">삭제</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {loading ? (
            <tr>
              <td colSpan={4} className="px-3 py-10 text-center text-zinc-500">부서 목록을 불러오는 중입니다...</td>
            </tr>
          ) : departments.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-3 py-10 text-center text-zinc-500">등록된 부서가 없습니다.</td>
            </tr>
          ) : (
            departments.map((dept) => (
              <tr key={dept.id}>
                <td className="px-3 py-3 text-right">{dept.id}</td>
                <td className="px-3 py-3 text-left">{dept.name}</td>
                <td className="px-3 py-3 text-left">{dept.description || '-'}</td>
                <td className="px-3 py-3 text-center">
                  <DepartmentDeleteButton departmentId={dept.id} onSuccess={fetchData} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
