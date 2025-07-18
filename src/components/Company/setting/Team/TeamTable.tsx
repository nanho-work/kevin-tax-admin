'use client';

import TeamCreateForm from './TeamCreateForm';
import TeamList from './TeamList';
import { useState } from 'react';

export default function TeamTable() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSuccess = () => setRefreshKey((prev) => prev + 1);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">팀 관리</h2>
      <TeamCreateForm onSuccess={handleSuccess} />
      <TeamList key={refreshKey} />
    </div>
  );
}