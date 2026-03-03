'use client';

import { useState } from 'react';
import type React from 'react';
import { createCompany } from '@/services/admin/company';
import type { CompanyCreateRequest } from '@/types/admin_campany';
import { useRouter } from 'next/navigation';

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            {description ? (
              <p className="mt-1 text-sm text-gray-500">{description}</p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`.trim()}>
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200';
const textareaClass =
  'w-full min-h-[96px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200';
const selectClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200';

function ToggleRow({ name, checked, onChange, label }: { name: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        name={name}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-200"
      />
    </label>
  );
}

export default function CompanyCreateForm() {
    const router = useRouter();
    const [form, setForm] = useState<CompanyCreateRequest>({
        category: '',
        company_name: '',
        owner_name: '',
        manager_name: '',
        manager_phone: '',
        manager_email: '',
        contact_method: '',
        memo: '',
        registration_number: '',
        monthly_fee: 0,
        contract_date: '',
        industry_type: '',
        business_type: '',
        cms_bank_account: '',
        cms_account_number: '',
        cms_transfer_day: '',
        phone: '',
        postal_code: '',
        address1: '',
        address2: '',
        founded_date: '',
        homepage_url: '',
        info_agreed: false,
        is_active: true,
        is_half_term: false,
        salary_date: '',
        salary_type: '',
        w_memo: '',
        is_export: false,
        is_online: false,
        v_note: '',
        v_remark: '',
        has_foreign_currency: false,
        ct_note: '',
        ct_remark: '',
    });

    const [error, setError] = useState<any>('');
    const [success, setSuccess] = useState('');

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement| HTMLSelectElement >
    ) => {
        const { name, value } = e.target;
        const target = e.target as HTMLInputElement; // 👈 명시적 단언
        const isCheckbox = target.type === 'checkbox';

        setForm((prev) => ({
            ...prev,
            [name]: isCheckbox ? target.checked : value,
        }));
    };

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        // empty input -> undefined for optional numeric fields
        if (value === '') {
            setForm((prev) => ({
                ...prev,
                [name]: name === 'monthly_fee' ? 0 : undefined,
            }));
            return;
        }

        const numberValue = Number(value);
        setForm((prev) => ({
            ...prev,
            [name]: Number.isNaN(numberValue) ? (name === 'monthly_fee' ? 0 : undefined) : numberValue,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const payload = { ...form };
            // Remove empty optional date fields (send undefined if empty)
            if (!payload.contract_date?.trim()) delete payload.contract_date;
            if (!payload.founded_date?.trim()) delete payload.founded_date;

            await createCompany(payload);
            setSuccess('등록 완료되었습니다.');
            router.push('/admin/companies'); // 등록 후 회사 목록으로 이동
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            const errorMsg = Array.isArray(detail)
                ? detail.map((d: any) => d.msg).join(', ')
                : detail || '등록 실패';
            setError(errorMsg);
        }
    };

    return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="sticky top-0 z-10 -mx-4 border-b border-gray-200 bg-white/90 px-4 py-4 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">업체 등록</h2>
              <p className="mt-1 text-sm text-gray-500">필수 항목을 입력하고 저장하면 회사와 관련 세무 정보가 함께 생성됩니다.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
              >
                등록하기
              </button>
            </div>
          </div>
        </div>

        {(error || success) && (
          <div
            className={
              success
                ? 'rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700'
                : 'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
            }
          >
            {success
              ? success
              : typeof error === 'string'
                ? error
                : Array.isArray((error as any)?.detail)
                  ? (error as any).detail.map((d: any) => d.msg).join(', ')
                  : '등록 중 오류가 발생했습니다.'}
          </div>
        )}

        <Section title="기본 정보" description="회사 식별 및 담당자 정보를 입력합니다.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="회사명" required>
              <input
                name="company_name"
                value={form.company_name}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </Field>

            <Field label="대표자명" required>
              <input
                name="owner_name"
                value={form.owner_name}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </Field>

            <Field label="사업자등록번호" required>
              <input
                name="registration_number"
                value={form.registration_number}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </Field>

            <Field label="구분">
              <select
                name="category"
                value={form.category}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange(e)}
                className={selectClass}
              >
                <option value="" disabled>
                  선택해주세요
                </option>
                <option value="법인">법인</option>
                <option value="개인">개인</option>
              </select>
            </Field>

            <Field label="업태">
              <input name="industry_type" value={form.industry_type} onChange={handleChange} className={inputClass} />
            </Field>

            <Field label="종목">
              <input name="business_type" value={form.business_type} onChange={handleChange} className={inputClass} />
            </Field>

            <Field label="기장료">
              <input
                name="monthly_fee"
                type="number"
                value={form.monthly_fee === 0 ? '' : String(form.monthly_fee)}
                onChange={handleNumberChange}
                className={inputClass}
              />
            </Field>

            <Field label="담당자 이름">
              <input name="manager_name" value={form.manager_name} onChange={handleChange} className={inputClass} />
            </Field>

            <Field label="담당자 전화번호">
              <input name="manager_phone" value={form.manager_phone} onChange={handleChange} className={inputClass} />
            </Field>

            <Field label="담당자 이메일">
              <input
                name="manager_email"
                type="email"
                value={form.manager_email}
                onChange={handleChange}
                className={inputClass}
              />
            </Field>

            <Field label="연락 방법">
              <input name="contact_method" value={form.contact_method} onChange={handleChange} className={inputClass} />
            </Field>

            <Field label="업체 연락처">
              <input name="phone" value={form.phone} onChange={handleChange} className={inputClass} />
            </Field>

            <Field label="우편번호">
              <input name="postal_code" value={form.postal_code} onChange={handleChange} className={inputClass} />
            </Field>

            <Field label="주소1">
              <input name="address1" value={form.address1} onChange={handleChange} className={inputClass} />
            </Field>

            <Field label="주소2">
              <input name="address2" value={form.address2} onChange={handleChange} className={inputClass} />
            </Field>

            <Field label="설립일">
              <input name="founded_date" type="date" value={form.founded_date || ''} onChange={handleChange} className={inputClass} />
            </Field>

            <Field label="홈페이지 URL">
              <input name="homepage_url" value={form.homepage_url} onChange={handleChange} className={inputClass} />
            </Field>

            <Field label="메모" className="md:col-span-2 xl:col-span-3">
              <textarea name="memo" value={form.memo} onChange={handleChange} className={textareaClass} />
            </Field>
          </div>
        </Section>

        <Section title="계약 / CMS" description="필요 시 계약 및 CMS 정보를 입력합니다.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="계약일">
              <input name="contract_date" type="date" value={form.contract_date || ''} onChange={handleChange} className={inputClass} />
            </Field>
            <Field label="CMS 은행명">
              <input name="cms_bank_account" value={form.cms_bank_account} onChange={handleChange} className={inputClass} />
            </Field>
            <Field label="CMS 계좌번호">
              <input name="cms_account_number" value={form.cms_account_number} onChange={handleChange} className={inputClass} />
            </Field>
            <Field label="CMS 이체일">
              <input name="cms_transfer_day" value={form.cms_transfer_day} onChange={handleChange} className={inputClass} />
            </Field>
          </div>
        </Section>

        <Section title="세무 옵션" description="원천/부가/법인 관련 옵션을 설정합니다.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ToggleRow name="info_agreed" checked={!!form.info_agreed} onChange={handleChange as any} label="정보 제공 동의" />
            <ToggleRow name="is_half_term" checked={!!form.is_half_term} onChange={handleChange as any} label="반기 여부" />
            <Field label="급여 지급일">
              <input name="salary_date" value={form.salary_date} onChange={handleChange} className={inputClass} />
            </Field>
            <Field label="급여 지급방식">
              <input name="salary_type" value={form.salary_type} onChange={handleChange} className={inputClass} />
            </Field>
            <Field label="급여 메모" className="md:col-span-2 xl:col-span-3">
              <textarea name="w_memo" value={form.w_memo} onChange={handleChange} className={textareaClass} />
            </Field>

            <ToggleRow name="is_export" checked={!!form.is_export} onChange={handleChange as any} label="수출 여부" />
            <ToggleRow name="is_online" checked={!!form.is_online} onChange={handleChange as any} label="온라인 사업 여부" />

            <Field label="부가세 비고" className="md:col-span-2 xl:col-span-3">
              <textarea name="v_note" value={form.v_note} onChange={handleChange} className={textareaClass} />
            </Field>
            <Field label="부가세 특이사항" className="md:col-span-2 xl:col-span-3">
              <textarea name="v_remark" value={form.v_remark} onChange={handleChange} className={textareaClass} />
            </Field>

            <ToggleRow name="has_foreign_currency" checked={!!form.has_foreign_currency} onChange={handleChange as any} label="외화 계좌/거래 여부" />

            <Field label="법인세 비고" className="md:col-span-2 xl:col-span-3">
              <textarea name="ct_note" value={form.ct_note} onChange={handleChange} className={textareaClass} />
            </Field>
            <Field label="법인세 특이사항" className="md:col-span-2 xl:col-span-3">
              <textarea name="ct_remark" value={form.ct_remark} onChange={handleChange} className={textareaClass} />
            </Field>

            <ToggleRow name="is_active" checked={!!form.is_active} onChange={handleChange as any} label="활성 상태" />
          </div>
        </Section>

      </form>
    </div>
  );
}
