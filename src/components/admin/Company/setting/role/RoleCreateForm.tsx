'use client';

import { useMemo, useState } from 'react';
import { createRole } from '@/services/client/roleService';
import { toast } from 'react-hot-toast';

const inputClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200';

function statusMessage(status?: number): string {
  if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
  if (status === 403) return '권한이 없어 직급을 생성할 수 없습니다.';
  if (status === 404) return '요청 대상을 찾을 수 없습니다.';
  if (status && status >= 500) return '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  return '직급 생성 중 오류가 발생했습니다.';
}

export default function RoleCreateForm({ onSuccess, adminLevel }: { onSuccess: () => void; adminLevel: number }) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState<number>(adminLevel === 1 ? 2 : 1);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const levelOptions = useMemo(() => {
    const min = adminLevel === 1 ? 2 : 0;
    return Array.from({ length: 11 - min }, (_, i) => i + min);
  }, [adminLevel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (adminLevel === 1 && level < 2) {
      toast.error('1레벨 사용자는 2레벨 이상만 생성할 수 있습니다.');
      return;
    }

    try {
      setSubmitting(true);
      await createRole({ name, level, description });
      toast.success('직급이 등록되었습니다.');
      setName('');
      setLevel(adminLevel === 1 ? 2 : 1);
      setDescription('');
      onSuccess();
    } catch (err: any) {
      toast.error(statusMessage(err?.response?.status));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="롤 이름" className={inputClass} required />
        <select
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          className={`${inputClass} text-right`}
          required
        >
          {levelOptions.map((lv) => (
            <option key={lv} value={lv}>{lv}</option>
          ))}
        </select>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="설명" className={inputClass} />
      </div>
      <div className="mt-3 flex justify-end">
        <button type="submit" disabled={submitting} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60">
          {submitting ? '등록 중...' : '등록'}
        </button>
      </div>
    </form>
  );
}
