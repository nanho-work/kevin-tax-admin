'use client';

import DepartmentCreateForm from './DepartmentCreateForm';
import DepartmentList from './DepartmentList';
import { useState } from 'react';

export default function DepartmentTable() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSuccess = () => setRefreshKey((prev) => prev + 1);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-4">
        <h2 className="text-base font-semibold text-zinc-900">부서 관리</h2>
        <p className="mt-1 text-sm text-zinc-500">부서 정보를 등록하고 목록을 관리할 수 있습니다.</p>
      </div>
      <DepartmentCreateForm onSuccess={handleSuccess} />
      <DepartmentList key={refreshKey} />
    </div>
  );
}
