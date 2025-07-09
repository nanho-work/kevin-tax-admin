"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
    fetchCorporateTaxDetails,
    deleteCorporateTaxDetail,
    updateCorporateTaxDetail,
    createCorporateTaxDetail, // ✅ 추가
} from "@/services/company";
import type { CorporateTaxDetailResponse } from "@/types/admin_campany";

interface Props {
    selectedCompanyId: number | null;
}

export default function CorporateTaxDetailTab({ selectedCompanyId }: Props) {
    const [data, setData] = useState<CorporateTaxDetailResponse[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [editableRows, setEditableRows] = useState<
        Record<number, Partial<CorporateTaxDetailResponse>>
    >({});
    const [newlyAddedId, setNewlyAddedId] = useState<number | null>(null);

    const loadData = async () => {
        try {
            const list = await fetchCorporateTaxDetails(selectedCompanyId || undefined);
            setData(list);
        } catch (error) {
            console.error("법인세 목록 조회 실패", error);
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
            await deleteCorporateTaxDetail(ids);
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
        field: keyof CorporateTaxDetailResponse,
        value: any
    ) => {
        setEditableRows((prev) => ({
            ...prev,
            [id]: { ...prev[id], [field]: value },
        }));
    };

    const handleBlur = async (
        row: CorporateTaxDetailResponse,
        field: keyof CorporateTaxDetailResponse,
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
                await updateCorporateTaxDetail(row.id, { [field]: parsedValue });
                toast.success("수정되었습니다.");
                await loadData();
            } catch (error) {
                console.error("수정 실패", error);
                toast.error("수정 중 오류가 발생했습니다.");
            }
        }
    };

    const getEditableValue = (
        row: CorporateTaxDetailResponse,
        id: number,
        field: keyof CorporateTaxDetailResponse
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

    // 항목 추가 핸들러
    const handleAdd = async () => {
        if (!selectedCompanyId) {
            toast.error("회사를 먼저 선택해주세요.");
            return;
        }

        try {
            const newItem = await createCorporateTaxDetail({
                company_id: selectedCompanyId,
                year: new Date().getFullYear().toString(),
                net_income_reported: 0,
                income_total: 0,
                deduction_total: 0,
                taxable_income: 0,
                total_tax_due: 0,
            });
            toast.success("법인세 항목이 추가되었습니다.");
            setNewlyAddedId(newItem.id); // ✅ 포커싱 ID 저장
            await loadData();
        } catch (err) {
            console.error("등록 실패", err);
            toast.error("등록 중 오류가 발생했습니다.");
        }
    };
    return (
        <div className="overflow-x-auto">
            <div className="mb-4 flex justify-between items-center">
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
                                await deleteCorporateTaxDetail(selectedIds); // ✅ 단일 호출로 다중 삭제
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
                        <th className="p-2 border">결산서상 당기순이익</th>
                        <th className="p-2 border">익금 항목1</th>
                        <th className="p-2 border">익금 금액1</th>
                        <th className="p-2 border">익금 항목2</th>
                        <th className="p-2 border">익금 금액2</th>
                        <th className="p-2 border">익금 항목3</th>
                        <th className="p-2 border">익금 금액3</th>
                        <th className="p-2 border">익금 항목4</th>
                        <th className="p-2 border">익금 금액4</th>
                        <th className="p-2 border">익금 산입 계</th>
                        <th className="p-2 border">손금 항목1</th>
                        <th className="p-2 border">손금 금액1</th>
                        <th className="p-2 border">손금 항목2</th>
                        <th className="p-2 border">손금 금액2</th>
                        <th className="p-2 border">손금 항목3</th>
                        <th className="p-2 border">손금 금액3</th>
                        <th className="p-2 border">손금 항목4</th>
                        <th className="p-2 border">손금 금액4</th>
                        <th className="p-2 border">손금 산입 계</th>
                        <th className="p-2 border">차가감 소득금액</th>
                        <th className="p-2 border">기부금 조정</th>
                        <th className="p-2 border">각 사업연도 소득금액</th>
                        <th className="p-2 border">이월결손금</th>
                        <th className="p-2 border">과세표준</th>
                        <th className="p-2 border">세율</th>
                        <th className="p-2 border">산출세액</th>
                        <th className="p-2 border">공제감면 항목1</th>
                        <th className="p-2 border">공제감면 세액1</th>
                        <th className="p-2 border">공제감면 항목2</th>
                        <th className="p-2 border">공제감면 세액2</th>
                        <th className="p-2 border">공제감면 항목3</th>
                        <th className="p-2 border">공제감면 세액3</th>
                        <th className="p-2 border">공제감면 항목4</th>
                        <th className="p-2 border">공제감면 세액4</th>
                        <th className="p-2 border">공제감면 세액계</th>
                        <th className="p-2 border">가산세액</th>
                        <th className="p-2 border">가감계</th>
                        <th className="p-2 border">기납부 세액</th>
                        <th className="p-2 border">감면분 추가납부세액</th>
                        <th className="p-2 border">차가감 납부할 세액계</th>
                        <th className="p-2 border">최저한세</th>
                        <th className="p-2 border">지방세</th>
                        <th className="p-2 border">농어촌특별세</th>
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

                            {/* 귀속연도 - editable number */}
                            <td className="p-2 border">
                                <input
                                    type="number"
                                    className="w-20 border rounded px-1 text-center"
                                    value={getEditableValue(row, row.id, "year") ?? ""}
                                    onChange={(e) =>
                                        handleEditableChange(row.id, "year", e.target.value)
                                    }
                                    onBlur={(e) =>
                                        handleBlur(row, "year", e.target.value)
                                    }
                                />
                            </td>
                            {/* 결산서상 당기순이익 - editable number */}
                            <td className="p-2 border">
                                <input
                                    type="number"
                                    className="w-28 border rounded px-1 text-right"
                                    value={getEditableValue(row, row.id, "net_income_reported") ?? ""}
                                    onChange={(e) =>
                                        handleEditableChange(row.id, "net_income_reported", e.target.value)
                                    }
                                    onBlur={(e) =>
                                        handleBlur(row, "net_income_reported", e.target.value)
                                    }
                                />
                            </td>
                            {/* 익금 항목1~4, 금액1~4, 산입 계 */}
                            {[
                                "income1", "income_amount1",
                                "income2", "income_amount2",
                                "income3", "income_amount3",
                                "income4", "income_amount4",
                                "income_total",
                            ].map((field) => (
                                <td key={field} className="p-2 border">
                                    <input
                                        type={field.includes("amount") || field.includes("total") ? "number" : "text"}
                                        className={`border rounded px-1 w-28 ${field.includes("amount") || field.includes("total") ? "text-right" : "text-center"
                                            }`}
                                        value={getEditableValue(row, row.id, field as any) ?? ""}
                                        onChange={(e) => handleEditableChange(row.id, field as any, e.target.value)}
                                        onBlur={(e) => handleBlur(row, field as any, e.target.value)}
                                    />
                                </td>
                            ))}
                            {/* 손금 항목1~4, 금액1~4, 산입 계 */}
                            {[
                                "deduction1", "deduction_amount1",
                                "deduction2", "deduction_amount2",
                                "deduction3", "deduction_amount3",
                                "deduction4", "deduction_amount4",
                                "deduction_total",
                            ].map((field) => (
                                <td key={field} className="p-2 border">
                                    <input
                                        type={field.includes("amount") || field.includes("total") ? "number" : "text"}
                                        className={`border rounded px-1 w-28 ${field.includes("amount") || field.includes("total") ? "text-right" : "text-center"
                                            }`}
                                        value={getEditableValue(row, row.id, field as any) ?? ""}
                                        onChange={(e) => handleEditableChange(row.id, field as any, e.target.value)}
                                        onBlur={(e) => handleBlur(row, field as any, e.target.value)}
                                    />
                                </td>
                            ))}
                            {/* 차가감 소득금액 ~ 농어촌특별세 */}
                            {[
                                "adjusted_income", "donation_adjustment", "taxable_income", "loss_carried_forward", "tax_base", "tax_rate", "calculated_tax",
                                "tax_credit_name1", "tax_credit_amount1", "tax_credit_name2", "tax_credit_amount2",
                                "tax_credit_name3", "tax_credit_amount3", "tax_credit_name4", "tax_credit_amount4",
                                "total_tax_credits", "additional_tax", "tax_adjusted", "prepaid_tax",
                                "additional_tax_reduced", "total_tax_due", "minimum_tax", "local_tax", "rural_special_tax"
                            ].map((field) => (
                                <td key={field} className="p-2 border">
                                    <input
                                        type={
                                            field.includes("amount") ||
                                                field.includes("tax") ||
                                                field.includes("income") ||
                                                field.includes("adjusted") ||
                                                field.includes("total") ||
                                                field.includes("base") ||
                                                field.includes("count")
                                                ? "number"
                                                : "text"
                                        }
                                        className={`border rounded px-1 w-28 ${field.includes("amount") ||
                                            field.includes("tax") ||
                                            field.includes("income") ||
                                            field.includes("adjusted") ||
                                            field.includes("total") ||
                                            field.includes("base") ||
                                            field.includes("count")
                                            ? "text-right"
                                            : "text-center"
                                            }`}
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
