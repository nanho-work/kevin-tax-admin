'use client';

import { useState } from 'react';
import { createCompany } from '@/services/company';
import type { CompanyUpdateRequest } from '@/types/admin_campany';
import { useRouter } from 'next/navigation';

export default function CompanyCreateForm() {
    const router = useRouter();
    const [form, setForm] = useState<CompanyUpdateRequest>({
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
        encrypted_hometax_id: '',
        encrypted_hometax_pw: '',
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
        manager_customer_id: undefined,
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
        const numberValue = value === '' ? 0 : Number(value);
        setForm((prev) => ({
            ...prev,
            [name]: numberValue,
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
            router.push('/admin/companies'); // 필요 시 목록 페이지로 이동
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            const errorMsg = Array.isArray(detail)
                ? detail.map((d: any) => d.msg).join(', ')
                : detail || '등록 실패';
            setError(errorMsg);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white shadow rounded">
            <h2 className="text-xl font-bold">업체 등록</h2>
            <section className="bg-gray-50 p-4 rounded border mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">회사명 *</label>
                        <input
                            name="company_name"
                            value={form.company_name}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                            required
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">대표자명 *</label>
                        <input
                            name="owner_name"
                            value={form.owner_name}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                            required
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">사업자등록번호 *</label>
                        <input
                            name="registration_number"
                            value={form.registration_number}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                            required
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">구분</label>
                        <select
                            name="category"
                            value={form.category}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange(e)}
                            className="w-full border px-3 py-2 rounded"
                        >
                            <option value="" disabled>선택해주세요</option>
                            <option value="법인">법인</option>
                            <option value="개인">개인</option>
                        </select>
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">업태</label>
                        <input
                            name="industry_type"
                            value={form.industry_type}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">종목</label>
                        <input
                            name="business_type"
                            value={form.business_type}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">기장료</label>
                        <input
                            name="monthly_fee"
                            type="number"
                            value={form.monthly_fee === 0 ? '' : String(form.monthly_fee)}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">담당자 이름</label>
                        <input
                            name="manager_name"
                            value={form.manager_name}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">담당자 전화번호</label>
                        <input
                            name="manager_phone"
                            value={form.manager_phone}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">담당자 이메일</label>
                        <input
                            name="manager_email"
                            type="email"
                            value={form.manager_email}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">연락 방법</label>
                        <input
                            name="contact_method"
                            value={form.contact_method}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">메모</label>
                        <textarea
                            name="memo"
                            value={form.memo}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">업체 연락처</label>
                        <input
                            name="phone"
                            value={form.phone}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">우편번호</label>
                        <input
                            name="postal_code"
                            value={form.postal_code}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">주소1</label>
                        <input
                            name="address1"
                            value={form.address1}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">주소2</label>
                        <input
                            name="address2"
                            value={form.address2}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">설립일</label>
                        <input
                            name="founded_date"
                            type="date"
                            value={form.founded_date || ''}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">홈페이지 URL</label>
                        <input
                            name="homepage_url"
                            value={form.homepage_url}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                </div>
            </section>
            <h3 className="text-base font-bold text-blue-800 mb-3">🧾 홈택스 정보</h3>
            <section className="bg-gray-50 p-4 rounded border mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">홈택스 아이디(암호화)</label>
                        <input
                            name="encrypted_hometax_id"
                            value={form.encrypted_hometax_id}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">홈택스 비밀번호(암호화)</label>
                        <input
                            name="encrypted_hometax_pw"
                            value={form.encrypted_hometax_pw}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">계약일</label>
                        <input
                            name="contract_date"
                            type="date"
                            value={form.contract_date || ''}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">CMS 은행명</label>
                        <input
                            name="cms_bank_account"
                            value={form.cms_bank_account}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">CMS 계좌번호</label>
                        <input
                            name="cms_account_number"
                            value={form.cms_account_number}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">CMS 이체일</label>
                        <input
                            name="cms_transfer_day"
                            value={form.cms_transfer_day}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                </div>
            </section>
            <h3 className="text-base font-bold text-blue-800 mb-3">💼 급여 및 세무 정보</h3>
            <section className="bg-gray-50 p-4 rounded border mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center">
                        <label className="flex items-center space-x-2">
                            <input
                                name="info_agreed"
                                type="checkbox"
                                checked={form.info_agreed}
                                onChange={handleChange}
                                className="rounded"
                            />
                            <span className="text-sm font-semibold text-gray-700">정보 제공 동의</span>
                        </label>
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">담당 고객 ID</label>
                        <input
                            name="manager_customer_id"
                            type="number"
                            value={form.manager_customer_id ?? ''}
                            onChange={handleNumberChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div className="flex items-center">
                        <label className="flex items-center space-x-2">
                            <input
                                name="is_half_term"
                                type="checkbox"
                                checked={form.is_half_term}
                                onChange={handleChange}
                                className="rounded"
                            />
                            <span className="text-sm font-semibold text-gray-700">반기 여부</span>
                        </label>
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">급여 지급일</label>
                        <input
                            name="salary_date"
                            value={form.salary_date}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div className="flex items-center">
                        <label className="flex items-center space-x-2">
                            <input
                                name="is_export"
                                type="checkbox"
                                checked={form.is_export}
                                onChange={handleChange}
                                className="rounded"
                            />
                            <span className="text-sm font-semibold text-gray-700">수출 여부</span>
                        </label>
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">급여 지급방식</label>
                        <input
                            name="salary_type"
                            value={form.salary_type}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div className="flex items-center">
                        <label className="flex items-center space-x-2">
                            <input
                                name="is_online"
                                type="checkbox"
                                checked={form.is_online}
                                onChange={handleChange}
                                className="rounded"
                            />
                            <span className="text-sm font-semibold text-gray-700">온라인 사업 여부</span>
                        </label>
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">급여 메모</label>
                        <textarea
                            name="w_memo"
                            value={form.w_memo}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>

                </div>
            </section>
            <h3 className="text-base font-bold text-blue-800 mb-3">📋 부가세 관련</h3>
            <section className="bg-gray-50 p-4 rounded border mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">부가세 비고</label>
                        <textarea
                            name="v_note"
                            value={form.v_note}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">부가세 특이사항</label>
                        <textarea
                            name="v_remark"
                            value={form.v_remark}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div className="flex items-center">
                        <label className="flex items-center space-x-2">
                            <input
                                name="has_foreign_currency"
                                type="checkbox"
                                checked={form.has_foreign_currency}
                                onChange={handleChange}
                                className="rounded"
                            />
                            <span className="text-sm font-semibold text-gray-700">외화 계좌/거래 여부</span>
                        </label>
                    </div>
                </div>
            </section>
            <h3 className="text-base font-bold text-blue-800 mb-3">🏢 법인세 관련</h3>
            <section className="bg-gray-50 p-4 rounded border mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">법인세 비고</label>
                        <textarea
                            name="ct_note"
                            value={form.ct_note}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-semibold text-gray-700">법인세 특이사항</label>
                        <textarea
                            name="ct_remark"
                            value={form.ct_remark}
                            onChange={handleChange}
                            className="w-full border px-3 py-2 rounded"
                        />
                    </div>
                </div>
            </section>
            <h3 className="text-base font-bold text-blue-800 mb-3">⚙️ 기타</h3>
            <section className="bg-gray-50 p-4 rounded border mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center">
                        <label className="flex items-center space-x-2">
                            <input
                                name="is_active"
                                type="checkbox"
                                checked={form.is_active}
                                onChange={handleChange}
                                className="rounded"
                            />
                            <span className="text-sm font-semibold text-gray-700">활성 상태</span>
                        </label>
                    </div>
                </div>
            </section>
            {error && (
                <p className="text-red-500">
                    {typeof error === 'string'
                        ? error
                        : Array.isArray(error?.detail)
                            ? error.detail.map((d: any) => d.msg).join(', ')
                            : '등록 중 오류가 발생했습니다.'}
                </p>
            )}
            {success && <p className="text-green-600">{success}</p>}
            <button
                type="submit"
                className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
                등록하기
            </button>
        </form>
    );
}