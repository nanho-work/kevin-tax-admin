"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "react-hot-toast";
import {
  fetchWithholdingTaxList,
  deleteWithholdingTax,
  updateWithholdingTax,
  createWithholdingTax,
} from "@/services/company";
import type { WithholdingTaxDetailResponse } from "@/types/admin_campany";

interface Props {
  selectedCompanyId: number | null;
}

export default function WithholdingTaxDetailTab({ selectedCompanyId }: Props) {
  const [data, setData] = useState<WithholdingTaxDetailResponse[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  // editable row state: id -> editableRow
  const [editableRows, setEditableRows] = useState<Record<number, Partial<WithholdingTaxDetailResponse>>>({});
  const [newlyAddedId, setNewlyAddedId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const loadData = async () => {
    try {
      const list = await fetchWithholdingTaxList(selectedCompanyId || undefined);
      setData(list);
    } catch (error) {
      console.error("원천세 목록 조회 실패", error);
    }
  };

  useEffect(() => {
    loadData();
    setEditableRows({});
  }, [selectedCompanyId]);

  useEffect(() => {
    if (newlyAddedId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [data, newlyAddedId]);

  const handleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const handleDelete = async (ids: number[]) => {
    if (!confirm(`${ids.length}개 항목을 삭제하시겠습니까?`)) return;
    try {
      await deleteWithholdingTax(ids); // ✅ 다중 삭제 요청 (axios)
      toast.success("삭제되었습니다.");
      await loadData();                // ✅ 리스트 다시 불러오기
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id))); // ✅ 선택 해제
    } catch (error) {
      console.error("삭제 실패", error);
      toast.error("삭제 중 오류가 발생했습니다.");
    }
  };
  // Helper for updating local editable row state
  const handleEditableChange = (id: number, field: string, value: any) => {
    setEditableRows((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  // Handler for blur (save if changed)
  const handleBlur = async (row: WithholdingTaxDetailResponse, field: keyof WithholdingTaxDetailResponse, value: any) => {
    const original = row[field];
    let parsedValue = value;
    // For numbers, parse value (but NOT for year, attribution_month, payment_month)
    if (
      (typeof original === "number" ||
        field.endsWith("_count") ||
        field.endsWith("_amount")) &&
      field !== "year" &&
      field !== "attribution_month" &&
      field !== "payment_month"
    ) {
      parsedValue = value === "" ? null : Number(value);
      if (isNaN(parsedValue)) return;
    }
    // For boolean fields
    if (
      field === "salary_reported" ||
      field === "daily_worker_filed" ||
      field === "simple_business"
    ) {
      parsedValue = value;
    }
    // Only update if changed
    if (original !== parsedValue) {
      try {
        await updateWithholdingTax(row.id, { [field]: parsedValue });
        toast.success("수정되었습니다.");
        await loadData();
      } catch (error) {
        // alert("수정 실패");
        console.error("수정 실패", error);
      }
    }
  };

  const handleAdd = async () => {
    if (!selectedCompanyId) {
      toast.error("회사를 먼저 선택해주세요.");
      return;
    }

    try {
      const newItem = await createWithholdingTax({
        company_id: selectedCompanyId,
        year: new Date().getFullYear().toString(), // 예시로 올해 연도
        attribution_month: "01",
        payment_month: "01",
        employee_count: 0,
        employee_amount: 0,
      });
      toast.success("원천세 항목이 추가되었습니다.");
      setNewlyAddedId(newItem.id);
      await loadData();
    } catch (err) {
      console.error("등록 실패", err);
      toast.error("등록 중 오류가 발생했습니다.");
    }
  };

  // Helper to get value for editable row
  const getEditableValue = (row: WithholdingTaxDetailResponse, id: number, field: keyof WithholdingTaxDetailResponse) => {
    if (editableRows[id] && editableRows[id][field] !== undefined && editableRows[id][field] !== null) {
      return editableRows[id][field];
    }
    return row[field];
  };

  return (
    <div className="w-full overflow-auto max-h-[calc(100vh-220px)]">
      <div className="min-w-[7000px]">
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
                await deleteWithholdingTax(selectedIds); // ✅ 단일 호출로 다중 삭제
                toast.success("원천세 항목이 삭제되었습니다.");
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
      <div className="mb-4 flex justify-between items-center">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          onClick={handleAdd}
        >
          + 원천세 항목 추가
        </button>
      </div>
      <table className="table-auto border border-gray-200 text-sm w-full">
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
            <th className="p-2">귀속연도</th>
            <th className="p-2">원천의무</th>
            <th className="p-2">급여신고</th>
            <th className="p-2">귀속월</th>
            <th className="p-2">지급월</th>
            <th className="p-2">근로인원</th>
            <th className="p-2">근로금액</th>
            <th className="p-2">비과세 제출</th>
            <th className="p-2">간이 근로</th>
            <th className="p-2">일용인원</th>
            <th className="p-2">일용금액</th>
            <th className="p-2">일용신고</th>
            <th className="p-2">사업인원</th>
            <th className="p-2">사업금액</th>
            <th className="p-2">간이 사업</th>
            <th className="p-2">기타인원</th>
            <th className="p-2">기타금액</th>
            <th className="p-2">퇴직인원</th>
            <th className="p-2">퇴직금액</th>
            <th className="p-2">생성일</th>
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
              {/* year - editable */}
              <td className="p-2">
                <input
                  ref={row.id === newlyAddedId ? inputRef : null}
                  type="text"
                  defaultValue={
                    getEditableValue(row, row.id, "year")?.toString() ?? ""
                  }
                  onChange={(e) => handleEditableChange(row.id, "year", e.target.value)}
                  onBlur={(e) => handleBlur(row, "year", e.target.value)}
                  className="w-16 border rounded px-2 text-center"
                />
              </td>
              {/* obligation - editable */}
              <td className="p-2">
                <input
                  type="text"
                  defaultValue={
                    getEditableValue(row, row.id, "obligation")?.toString() ?? ""
                  }
                  onChange={(e) => handleEditableChange(row.id, "obligation", e.target.value)}
                  onBlur={(e) => handleBlur(row, "obligation", e.target.value)}
                  className="w-24 border rounded px-2"
                />
              </td>
              {/* salary_reported - editable boolean */}
              <td className="p-2">
                <select
                  defaultValue={row.salary_reported ? "O" : "X"}
                  onChange={e => handleEditableChange(row.id, "salary_reported", e.target.value === "O")}
                  onBlur={e => handleBlur(row, "salary_reported", e.target.value === "O")}
                  className="w-16 border rounded px-2 text-center"
                >
                  <option value="O">O</option>
                  <option value="X">X</option>
                </select>
              </td>
              {/* attribution_month - editable */}
              <td className="p-2">
                <input
                  type="text"
                  defaultValue={
                    getEditableValue(row, row.id, "attribution_month")?.toString() ?? ""
                  }
                  onChange={(e) => handleEditableChange(row.id, "attribution_month", e.target.value)}
                  onBlur={(e) => handleBlur(row, "attribution_month", e.target.value)}
                  className="w-16 border rounded px-2 text-center"
                />
              </td>
              {/* payment_month - editable */}
              <td className="p-2">
                <input
                  type="text"
                  defaultValue={
                    getEditableValue(row, row.id, "payment_month")?.toString() ?? ""
                  }
                  onChange={(e) => handleEditableChange(row.id, "payment_month", e.target.value)}
                  onBlur={(e) => handleBlur(row, "payment_month", e.target.value)}
                  className="w-16 border rounded px-2 text-center"
                />
              </td>
              {/* 반복 입력 필드들 */}
              {[
                { key: "employee_count", label: "근로인원", width: "w-16", align: "text-center" },
                { key: "employee_amount", label: "근로금액", width: "w-28", align: "text-right" },
                { key: "untaxed_submitted", label: "비과세 제출", width: "w-20", align: "text-right" },
                { key: "simple_employee", label: "간이 근로", width: "w-20", align: "text-center" },
                { key: "daily_worker_count", label: "일용인원", width: "w-16", align: "text-center" },
                { key: "daily_worker_amount", label: "일용금액", width: "w-28", align: "text-right" },
                { key: "business_worker_count", label: "사업인원", width: "w-16", align: "text-center" },
                { key: "business_worker_amount", label: "사업금액", width: "w-28", align: "text-right" },
                { key: "etc_worker_count", label: "기타인원", width: "w-16", align: "text-center" },
                { key: "etc_worker_amount", label: "기타금액", width: "w-28", align: "text-right" },
                { key: "retirement_count", label: "퇴직인원", width: "w-16", align: "text-center" },
                { key: "retirement_amount", label: "퇴직금액", width: "w-28", align: "text-right" },
              ].map(({ key, width, align }) => (
                <td key={key} className={`p-2`}>
                  <input
                    type="number"
                    defaultValue={
                      getEditableValue(row, row.id, key as keyof WithholdingTaxDetailResponse)?.toString() ?? ""
                    }
                    onChange={(e) => handleEditableChange(row.id, key, e.target.value)}
                    onBlur={(e) => handleBlur(row, key as keyof WithholdingTaxDetailResponse, e.target.value)}
                    className={`${width} border rounded px-2 ${align}`}
                  />
                </td>
              ))}
              {/* daily_worker_filed - editable boolean */}
              <td className="p-2">
                <select
                  defaultValue={row.daily_worker_filed ? "O" : "X"}
                  onChange={e => handleEditableChange(row.id, "daily_worker_filed", e.target.value === "O")}
                  onBlur={e => handleBlur(row, "daily_worker_filed", e.target.value === "O")}
                  className="w-16 border rounded px-2 text-center"
                >
                  <option value="O">O</option>
                  <option value="X">X</option>
                </select>
              </td>
              {/* simple_business - editable boolean */}
              <td className="p-2">
                <select
                  defaultValue={row.simple_business ? "O" : "X"}
                  onChange={e => handleEditableChange(row.id, "simple_business", e.target.value === "O")}
                  onBlur={e => handleBlur(row, "simple_business", e.target.value === "O")}
                  className="w-16 border rounded px-2 text-center"
                >
                  <option value="O">O</option>
                  <option value="X">X</option>
                </select>
              </td>
              {/* created_at - read only */}
              <td className="p-2">{row.created_at?.split("T")[0]}</td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={22} className="text-center text-gray-400 py-6">
                데이터가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
  );
}
