'use client';

import { useState } from 'react';
import { createRole } from '@/services/roleService';

export default function RoleCreateForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [rankOrder, setRankOrder] = useState<number>(1);
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRole({ name, rank_order: rankOrder, description });
    setName('');
    setRankOrder(1);
    setDescription('');
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="롤 이름" className="border px-2 py-1" required />
      <input type="number" value={rankOrder} onChange={(e) => setRankOrder(Number(e.target.value))} placeholder="순서" className="border px-2 py-1" required />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="설명" className="border px-2 py-1" />
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">등록</button>
    </form>
  );
}
