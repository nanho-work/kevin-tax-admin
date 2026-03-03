'use client';

import React, { useState } from 'react';
import type { CompanyTaxDetail } from '@/types/admin_campany';
import WithholdingTaxDetailTab from '@/components/admin/Company/tabs/WithholdingTaxDetailTab';
import CorporateTaxDetailTab from '@/components/admin/Company/tabs/CorporateTaxDetails';
import FinancialStatementTab from '@/components/admin/Company/tabs/FinancialStatement';

interface CompanyReportTabsProps {
  selectedCompany: CompanyTaxDetail | null;
}

const tabs = [
  '재무제표',
  '원천세',
  '법인세',
  '부가세',
  '공제 및 결손금 이월관리',
  '업무승용차',
  '공제감면 리스트',
];

export default function CompanyReportTabs({ selectedCompany }: CompanyReportTabsProps) {
  const [activeTab, setActiveTab] = useState('재무제표');

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white px-4 pt-4">
        <div className="text-base font-semibold text-zinc-900">회사 귀속 보고서</div>
        <p className="mt-1 text-sm text-zinc-600">탭을 선택해 항목별 데이터를 조회·편집하세요.</p>
        <div className="mt-4 border-b border-zinc-200">
          <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-t-md px-4 py-2 text-sm ${
                activeTab === tab
                  ? 'border border-zinc-200 border-b-white bg-white font-semibold text-zinc-900'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {tab}
            </button>
          ))}
          </div>
        </div>
      </div>
      <div className="w-full max-w-[100vw] overflow-x-hidden">
        {selectedCompany ? (
          <>
            {activeTab === '재무제표' && (
              <FinancialStatementTab selectedCompanyId={selectedCompany.id} />
            )}
            {activeTab === '원천세' && (
              <WithholdingTaxDetailTab selectedCompanyId={selectedCompany.id} />
            )}
            {activeTab === '법인세' && (
              <CorporateTaxDetailTab selectedCompanyId={selectedCompany.id} />
            )}
            {activeTab !== '재무제표' && activeTab !== '원천세' && activeTab !== '법인세' && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
                {activeTab} 탭은 아직 구현되지 않았습니다.
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
            회사를 선택하면 {activeTab} 항목이 표시됩니다.
          </div>
        )}
      </div>
    </div>
  );
}
