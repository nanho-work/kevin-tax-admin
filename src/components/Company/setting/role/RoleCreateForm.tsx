'use client';

import { useState } from 'react';
import { createRole } from '@/services/roleService';

const inputClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200';

export default function RoleCreateForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState<number>(1);
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRole({ name, level, description });
    setName('');
    setLevel(1);
    setDescription('');
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="롤 이름" className={inputClass} required />
        <input
          type="number"
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          placeholder="레벨"
          className={`${inputClass} text-right`}
          required
        />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="설명" className={inputClass} />
      </div>
      <div className="mt-3 flex justify-end">
        <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">등록</button>
      </div>
    </form>
  );
}
