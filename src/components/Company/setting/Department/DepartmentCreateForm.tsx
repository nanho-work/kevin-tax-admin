'use client';

import { useState } from 'react';
import { createDepartment } from '@/services/departmentService';

export default function DepartmentCreateForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createDepartment({ name, description });
    setName('');
    setDescription('');
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mb-6">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="부서 이름"
        className="border px-2 py-1 w-full"
        required
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="설명"
        className="border px-2 py-1 w-full"
      />
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">등록</button>
    </form>
  );
}