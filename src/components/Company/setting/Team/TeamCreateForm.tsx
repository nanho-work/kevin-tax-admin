'use client';

import { useState, useEffect } from 'react';
import { createTeam } from '@/services/teamService';
import { getDepartments } from '@/services/departmentService';

import type { DepartmentOut } from '@/types/department';

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
    <form onSubmit={handleSubmit} className="space-y-4 mb-6">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="팀 이름" className="border px-2 py-1" required />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="설명" className="border px-2 py-1" />
      <select
        value={departmentId ?? ''}
        onChange={(e) => setDepartmentId(Number(e.target.value) || null)}
        className="border px-2 py-1"
      >
        <option value="">부서 선택 (선택사항)</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">등록</button>
    </form>
  );
}