'use client';

import React, { useState } from 'react';
import type { CompanyTaxDetail } from '@/types/admin_campany';
import WithholdingTaxDetailTab from '@/components/Company/tabs/WithholdingTaxDetailTab';
import CorporateTaxDetailTab from '@/components/Company/tabs/CorporateTaxDetails';
import FinancialStatementTab from '@/components/Company/tabs/FinancialStatement';

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
    <div className="mt-6">
      <div className="flex gap-2 border-b pb-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border rounded-t ${activeTab === tab
              ? 'bg-white text-blue-600 border-b-2 border-blue-600'
              : 'bg-gray-100 text-gray-600 hover:bg-white'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="w-full max-w-[100vw] overflow-x-hidden">
        <div className="w-full overflow-x-auto">
          <div className="min-w-[1000px]">
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
                  <div className="text-gray-400 text-sm">{activeTab} 탭은 아직 구현되지 않았습니다.</div>
                )}
              </>
            ) : (
              <p className="text-gray-400 text-sm">회사를 선택하면 {activeTab} 항목이 표시됩니다.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}