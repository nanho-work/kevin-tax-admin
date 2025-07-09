'use client';

import { useState } from 'react';
import { createSingleTax } from '@/services/single_scheduleService';
import { ScheduleTypeEnum, SingleTaxCreate, StatusEnum } from '@/types/single_schedule';
import toast from 'react-hot-toast';

const scheduleTypeOptions: ScheduleTypeEnum[] = ['양도세', '상속세', '증여세', '기타'];

export default function SingleScheduleForm() {
  const [form, setForm] = useState<SingleTaxCreate>({
    title: '',
    client_name: '',
    memo: '',
    schedule_type: '기타',
    due_date: '',
    status: 'PENDING',
    completed_at: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        schedule_type: form.schedule_type as ScheduleTypeEnum,
        status: form.status as StatusEnum,
        due_date: form.due_date ? `${form.due_date}:00` : undefined,
        completed_at: form.completed_at?.trim() ? `${form.completed_at}:00` : undefined,
      };

      await createSingleTax(payload);
      toast.success('일정이 등록되었습니다.');
      window.location.reload(); 

      setForm({
        title: '',
        client_name: '',
        memo: '',
        schedule_type: '기타',
        due_date: '',
        status: 'PENDING',
        completed_at: '',
      });
    } catch (error) {
      console.error(error);
      toast.error('일정 등록에 실패했습니다.');
    }
  };

  return (
    <form onSubmit={handleSubmit} >
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="제목"
          className="border px-3 py-2 rounded w-40"
          required
        />
        <input
          name="client_name"
          value={form.client_name}
          onChange={handleChange}
          placeholder="고객명"
          className="border px-3 py-2 rounded w-32"
          required
        />
        <select
          name="schedule_type"
          value={form.schedule_type}
          onChange={handleChange}
          className="border px-3 py-2 rounded w-28"
        >
          {scheduleTypeOptions.map(type => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <input
          name="due_date"
          value={form.due_date}
          onChange={handleChange}
          type="datetime-local"
          className="border px-3 py-2 rounded w-56"
          required
        />

        <textarea
          name="memo"
          value={form.memo}
          onChange={handleChange}
          placeholder="메모"
          rows={1}
          className="border px-3 py-2 rounded w-96"
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          등록
        </button>
      </div>
    </form>
  );
}