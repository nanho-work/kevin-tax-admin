'use client';

import { useState } from 'react';
import { createDepartment } from '@/services/departmentService';

const inputClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200';

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
    <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="부서 이름" className={inputClass} required />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="설명" className={inputClass} />
      </div>
      <div className="mt-3 flex justify-end">
        <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">등록</button>
      </div>
    </form>
  );
}
