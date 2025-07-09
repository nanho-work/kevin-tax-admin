

"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
    fetchFinancialStatements,
    deleteFinancialStatement,
    updateFinancialStatement,
    createFinancialStatement,
} from "@/services/company";
import type { FinancialStatementResponse } from "@/types/admin_campany";

interface Props {
    selectedCompanyId: number | null;
}

export default function FinancialStatementTab({ selectedCompanyId }: Props) {
    const [data, setData] = useState<FinancialStatementResponse[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [editableRows, setEditableRows] = useState<
        Record<number, Partial<FinancialStatementResponse>>
    >({});
    const [newlyAddedId, setNewlyAddedId] = useState<number | null>(null);

    const loadData = async () => {
        try {
            const list = await fetchFinancialStatements(selectedCompanyId || undefined);
            setData(list);
        } catch (error) {
            console.error("재무제표 목록 조회 실패", error);
        }
    };

    useEffect(() => {
        loadData();
        setEditableRows({});
    }, [selectedCompanyId]);

    const handleSelect = (id: number) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
        );
    };

    const handleDelete = async (ids: number[]) => {
        if (!confirm(`${ids.length}개 항목을 삭제하시겠습니까?`)) return;
        try {
            await deleteFinancialStatement(ids);
            toast.success("삭제되었습니다.");
            await loadData();
            setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
        } catch (error) {
            console.error("삭제 실패", error);
            toast.error("삭제 중 오류가 발생했습니다.");
        }
    };

    const handleEditableChange = (
        id: number,
        field: keyof FinancialStatementResponse,
        value: any
    ) => {
        setEditableRows((prev) => ({
            ...prev,
            [id]: { ...prev[id], [field]: value },
        }));
    };

    const handleBlur = async (
        row: FinancialStatementResponse,
        field: keyof FinancialStatementResponse,
        value: any
    ) => {
        const original = row[field];
        let parsedValue = value;
        if (
            (typeof original === "number" || field.endsWith("_amount")) &&
            field !== "year"
        ) {
            parsedValue = value === "" ? null : Number(value);
            if (isNaN(parsedValue)) return;
        }
        if (original !== parsedValue) {
            try {
                await updateFinancialStatement(row.id, { [field]: parsedValue });
                toast.success("수정되었습니다.");
                await loadData();
            } catch (error) {
                console.error("수정 실패", error);
                toast.error("수정 중 오류가 발생했습니다.");
            }
        }
    };

    const handleAdd = async () => {
        if (!selectedCompanyId) {
            toast.error("회사를 먼저 선택해주세요.");
            return;
        }

        try {
            const newItem = await createFinancialStatement({
                company_id: selectedCompanyId,
                year: new Date().getFullYear().toString(),
            });
            toast.success("재무제표 항목이 추가되었습니다.");
            setNewlyAddedId(newItem.id); // ✅ 포커싱을 위한 ID 저장
            await loadData();
        } catch (err) {
            console.error("등록 실패", err);
            toast.error("등록 중 오류가 발생했습니다.");
        }
    };

    const getEditableValue = (
        row: FinancialStatementResponse,
        id: number,
        field: keyof FinancialStatementResponse
    ) => {
        if (
            editableRows[id] &&
            editableRows[id][field] !== undefined &&
            editableRows[id][field] !== null
        ) {
            return editableRows[id][field];
        }
        return row[field];
    };
    return (
        <div className="overflow-x-auto">
            <div className="mb-2">
                <button
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    onClick={handleAdd}
                >
                    항목 추가
                </button>
            </div>
            {selectedIds.length > 0 && (
                <div className="mb-4 flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                        선택된 항목: {selectedIds.length}개
                    </span>
                    <button
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                        onClick={async () => {
                            if (!confirm(`${selectedIds.length}개 항목을 삭제하시겠습니까?`)) return;
                            try {
                                await deleteFinancialStatement(selectedIds); // ✅ 단일 호출로 다중 삭제
                                toast.success("법인세 항목이 삭제되었습니다.");
                                await loadData();
                                setSelectedIds([]);
                            } catch (err) {
                                console.error("일괄 삭제 실패", err);
                                toast.error("삭제 중 오류가 발생했습니다.");
                            }
                        }}
                    >
                        선택 삭제
                    </button>
                </div>
            )}
            <table className="table-auto border border-gray-200 text-sm min-w-[7000px]">
                <thead>
                    <tr className="bg-gray-100 text-center">
                        <th className="p-2">
                            <input
                                type="checkbox"
                                onChange={(e) => {
                                    setSelectedIds(
                                        e.target.checked ? data.map((row) => row.id) : []
                                    );
                                }}
                                checked={selectedIds.length === data.length && data.length > 0}
                            />
                        </th>
                        <th className="p-2 border">귀속연도</th>
                        <th className="p-2 border">개업일</th>
                        <th className="p-2 border">당좌자산</th>
                        <th className="p-2 border">매출채권</th>
                        <th className="p-2 border">단기영업채권</th>
                        <th className="p-2 border">재고자산</th>
                        <th className="p-2 border">유동자산</th>

                        <th className="p-2 border">유형자산</th>
                        <th className="p-2 border">무형자산</th>
                        <th className="p-2 border">기타비유동자산</th>
                        <th className="p-2 border">비유동자산</th>
                        <th className="p-2 border">자산총계</th>

                        <th className="p-2 border">단기영업부채</th>
                        <th className="p-2 border">단기금융부채</th>
                        <th className="p-2 border">유동부채</th>
                        <th className="p-2 border">장기금융부채</th>
                        <th className="p-2 border">비유동부채</th>
                        <th className="p-2 border">부채총계</th>

                        <th className="p-2 border">주임동채권</th>
                        <th className="p-2 border">주임종채무</th>

                        <th className="p-2 border">자본금</th>
                        <th className="p-2 border">자본잉여금</th>
                        <th className="p-2 border">자본조정</th>
                        <th className="p-2 border">미처분이익잉여금(결손금)</th>
                        <th className="p-2 border">자본총계</th>
                        <th className="p-2 border">부채 및 자본 총계</th>
                        <th className="p-2 border">부채 및 자본 총계2</th>

                        <th className="p-2 border">매출액</th>
                        <th className="p-2 border">매입원가</th>
                        <th className="p-2 border">매출원가</th>
                        <th className="p-2 border">매출총이익</th>
                        <th className="p-2 border">판매비와 관리비</th>
                        <th className="p-2 border">감가상각비</th>
                        <th className="p-2 border">무형자산상각비</th>
                        <th className="p-2 border">임차료</th>

                        <th className="p-2 border">영업이익</th>
                        <th className="p-2 border">영업외 수익</th>
                        <th className="p-2 border">영업외 비용</th>
                        <th className="p-2 border">이자비용</th>
                        <th className="p-2 border">법인세 차감 전 손익</th>
                        <th className="p-2 border">법인세</th>
                        <th className="p-2 border">당기순손익</th>
                        <th className="p-2 border">EBITDA</th>
                        <th className="p-2 border">생성일</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((row) => (
                        <tr
                            key={row.id}
                            className={`border-t text-center ${row.id === newlyAddedId ? "bg-yellow-100" : ""}`}
                        >
                            <td className="p-2">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(row.id)}
                                    onChange={() => handleSelect(row.id)}
                                />
                            </td>
                            {/* 귀속연도 */}
                            <td className="p-2 border">
                                <input
                                    type="number"
                                    className="w-20 border rounded px-1 text-center"
                                    value={getEditableValue(row, row.id, "year") ?? ""}
                                    onChange={(e) => handleEditableChange(row.id, "year", e.target.value)}
                                    onBlur={(e) => handleBlur(row, "year", e.target.value)}
                                />
                            </td>
                            {/* 개업일 */}
                            <td className="p-2 border">
                                <input
                                    type="date"
                                    className="border text-center rounded px-1"
                                    value={getEditableValue(row, row.id, "open_date") ?? ""}
                                    onChange={(e) => handleEditableChange(row.id, "open_date", e.target.value)}
                                    onBlur={(e) => handleBlur(row, "open_date", e.target.value)}
                                />
                            </td>

                            {/* 숫자 항목들 - 오른쪽 정렬 */}
                            {[
                                "current_assets_cash", "accounts_receivable", "short_term_trade_receivables", "inventory", "current_assets",
                                "tangible_assets", "intangible_assets", "other_non_current_assets", "non_current_assets", "total_assets",
                                "short_term_trade_liabilities", "short_term_financial_liabilities", "current_liabilities", "long_term_financial_liabilities",
                                "non_current_liabilities", "total_liabilities", "related_party_receivables", "related_party_payables",
                                "capital_stock", "capital_surplus", "capital_adjustment", "retained_earnings", "total_equity",
                                "total_liabilities_and_equity", "total_liabilities_and_equity_2", "revenue", "purchase_cost",
                                "cost_of_goods_sold", "gross_profit", "sg_and_a", "depreciation", "amortization", "rent_expense",
                                "operating_income", "non_operating_income", "non_operating_expense", "interest_expense",
                                "income_before_tax", "corporate_tax", "net_income", "ebitda"
                            ].map((field) => (
                                <td key={field} className="p-2 border">
                                    <input
                                        type="number"
                                        className="w-28 border rounded px-1 text-right"
                                        value={getEditableValue(row, row.id, field as any) ?? ""}
                                        onChange={(e) => handleEditableChange(row.id, field as any, e.target.value)}
                                        onBlur={(e) => handleBlur(row, field as any, e.target.value)}
                                    />
                                </td>
                            ))}
                            {/* 생성일 - read only */}
                            <td className="p-2 border text-gray-500">
                                {row.created_at?.split("T")[0] || "-"}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
