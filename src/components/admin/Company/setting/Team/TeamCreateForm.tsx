'use client';

import { useState, useEffect } from 'react';
import { createTeam } from '@/services/admin/teamService';
import { getDepartments } from '@/services/admin/departmentService';
import type { DepartmentOut } from '@/types/department';

const inputClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200';

export default function TeamCreateForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);

  useEffect(() => {
    (async () => {
      const data = await getDepartments();
      setDepartments(data);
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTeam({ name, description, department_id: departmentId || undefined });
    setName('');
    setDescription('');
    setDepartmentId(null);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="팀 이름" className={inputClass} required />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="설명" className={inputClass} />
        <select
          value={departmentId ?? ''}
          onChange={(e) => setDepartmentId(Number(e.target.value) || null)}
          className={inputClass}
        >
          <option value="">부서 선택 (선택사항)</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 flex justify-end">
        <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">등록</button>
      </div>
    </form>
  );
}
