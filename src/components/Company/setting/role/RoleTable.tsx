'use client';

import RoleCreateForm from './RoleCreateForm';
import RoleList from './RoleList';
import { useState } from 'react';

export default function RoleTable() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSuccess = () => setRefreshKey((prev) => prev + 1);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">롤 관리</h2>
      <RoleCreateForm onSuccess={handleSuccess} />
      <RoleList key={refreshKey} />
    </div>
  );
}