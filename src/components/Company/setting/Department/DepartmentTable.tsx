'use client';

import DepartmentCreateForm from './DepartmentCreateForm';
import DepartmentList from './DepartmentList';
import { useState } from 'react';

export default function DepartmentTable() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSuccess = () => setRefreshKey((prev) => prev + 1);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">부서 관리</h2>
      <DepartmentCreateForm onSuccess={handleSuccess} />
      <DepartmentList key={refreshKey} />
    </div>
  );
}