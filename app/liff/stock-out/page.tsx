"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, Search, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useLiff } from "../layout";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";
import type { Branch, ItemWithRelations, InventoryLot } from "@/types/database";

const OUT_REASONS = [
  { value: "ใช้ปรุงอาหาร", label: "ใช้ปรุงอาหาร" },
  { value: "เสีย/หมดอายุ", label: "เสีย/หมดอายุ" },
  { value: "ชำรุด", label: "ชำรุด" },
  { value: "ให้ฟรี/ตัวอย่าง", label: "ให้ฟรี/ตัวอย่าง" },
  { value: "อื่นๆ", label: "อื่นๆ" },
];

export default function LiffStockOutPage() {
  const router = useRouter();
  const { liff, isInClient } = useLiff();

  // Master data
  const [items, setItems] = useState<ItemWithRelations[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [amount, setAmount] = useState("");
  const [outReason, setOutReason] = useState("ใช้ปรุงอาหาร");
  const [note, setNote] = useState("");

  // UI state
  const [itemSearch, setItemSearch] = useState("");
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Load master data
  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();
        const [itemsRes, branchesRes] = await Promise.all([
          supabase
            .from("items")
            .select("*, unit:units(*), category:categories(*)")
            .order("name"),
          supabase.from("branches").select("*").order("name"),
        ]);
        setItems((itemsRes.data as ItemWithRelations[]) || []);
        setBranches((branchesRes.data as Branch[]) || []);
        if (branchesRes.data && branchesRes.data.length > 0) {
          setSelectedBranchId(branchesRes.data[0].id);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Load lots when branch changes
  useEffect(() => {
    if (!selectedBranchId) return;
    async function fetchLots() {
      const supabase = createClient();
      const { data } = await supabase
        .from("inventory")
        .select("*")
        .eq("branch_id", selectedBranchId)
        .gt("remaining_qty", 0)
        .order("received_date", { ascending: true });
      setLots((data as InventoryLot[]) || []);
    }
    fetchLots();
  }, [selectedBranchId]);

  // Current stock for selected item
  const currentStock = useMemo(() => {
    if (!selectedItemId || !selectedBranchId) return 0;
    return lots
      .filter((l) => l.item_id === selectedItemId)
      .reduce((sum, l) => sum + l.remaining_qty, 0);
  }, [lots, selectedItemId, selectedBranchId]);

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return items;
    const q = itemSearch.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, itemSearch]);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedItemId),
    [items, selectedItemId]
  );

  const isValid =
    selectedItemId &&
    selectedBranchId &&
    amount &&
    Number(amount) > 0 &&
    Number(amount) <= currentStock &&
    outReason;

  const handleSubmit = useCallback(async () => {
    if (!isValid || submitting) return;

    setSubmitting(true);
    setSubmitResult(null);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "out",
          item_id: selectedItemId,
          branch_id: selectedBranchId,
          amount: Number(amount),
          unit: selectedItem?.unit?.name || null,
          out_reason: outReason,
          note,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSubmitResult({
          success: true,
          message: `เบิก ${selectedItem?.name || ""} จำนวน ${amount} ${selectedItem?.unit?.name || ""} สำเร็จ`,
        });
        // Refresh lots & reset form
        setSelectedItemId("");
        setAmount("");
        setNote("");
        // Reload lots
        const supabase = createClient();
        const { data: newLots } = await supabase
          .from("inventory")
          .select("*")
          .eq("branch_id", selectedBranchId)
          .gt("remaining_qty", 0)
          .order("received_date", { ascending: true });
        setLots((newLots as InventoryLot[]) || []);
      } else {
        setSubmitResult({
          success: false,
          message: data.error || "เกิดข้อผิดพลาด กรุณาลองใหม่",
        });
      }
    } catch {
      setSubmitResult({
        success: false,
        message: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้",
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    isValid,
    submitting,
    selectedItemId,
    selectedBranchId,
    amount,
    selectedItem,
    outReason,
    note,
  ]);

  const handleClose = useCallback(() => {
    if (liff && isInClient) {
      liff.closeWindow();
    } else {
      router.push("/liff");
    }
  }, [liff, isInClient, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-3rem)]">
      {/* Sub-header */}
      <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push("/liff")}
          className="p-1 hover:bg-red-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-red-700" />
        </button>
        <h2 className="text-base font-semibold text-red-800">เบิกสต็อก</h2>
      </div>

      {/* Success/Error banner */}
      {submitResult && (
        <div
          className={`mx-4 mt-3 p-3 rounded-lg text-sm ${
            submitResult.success
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {submitResult.message}
        </div>
      )}

      {/* Form */}
      <div className="flex-1 p-4 space-y-4">
        {/* Branch Select */}
        <div>
          <Label className="text-sm font-medium text-gray-700">
            สาขา <span className="text-red-500">*</span>
          </Label>
          <select
            value={selectedBranchId}
            onChange={(e) => {
              setSelectedBranchId(e.target.value);
              setSelectedItemId("");
              setAmount("");
            }}
            className="mt-1 w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">เลือกสาขา</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.is_hq ? " (สำนักงานใหญ่)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Item Picker */}
        <div>
          <Label className="text-sm font-medium text-gray-700">
            สินค้า <span className="text-red-500">*</span>
          </Label>
          <button
            onClick={() => setShowItemPicker(true)}
            className="mt-1 w-full flex items-center justify-between h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-left"
          >
            <span className={selectedItem ? "text-gray-900" : "text-gray-400"}>
              {selectedItem ? selectedItem.name : "เลือกสินค้า..."}
            </span>
            <Search className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {/* Current Stock Info */}
        {selectedItemId && selectedBranchId && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">สต็อกคงเหลือ</span>
              <Badge
                variant={
                  currentStock <= 0
                    ? "destructive"
                    : currentStock <= (selectedItem?.min_stock || 0)
                      ? "warning"
                      : "success"
                }
              >
                {formatNumber(currentStock)} {selectedItem?.unit?.name || ""}
              </Badge>
            </div>
            {currentStock <= 0 && (
              <div className="flex items-center gap-1.5 mt-2 text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="text-xs">ไม่มีสต็อกเหลือ</span>
              </div>
            )}
          </div>
        )}

        {/* Amount */}
        <div>
          <Label className="text-sm font-medium text-gray-700">
            จำนวนที่เบิก <span className="text-red-500">*</span>
            {selectedItem?.unit?.name && (
              <span className="font-normal text-gray-500">
                {" "}
                ({selectedItem.unit.name})
              </span>
            )}
          </Label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1"
          />
          {amount && Number(amount) > currentStock && (
            <p className="mt-1 text-xs text-red-500">
              จำนวนเกินสต็อกคงเหลือ (เหลือ {formatNumber(currentStock)})
            </p>
          )}
        </div>

        {/* Out Reason */}
        <div>
          <Label className="text-sm font-medium text-gray-700">
            เหตุผลการเบิก <span className="text-red-500">*</span>
          </Label>
          <select
            value={outReason}
            onChange={(e) => setOutReason(e.target.value)}
            className="mt-1 w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {OUT_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Note */}
        <div>
          <Label className="text-sm font-medium text-gray-700">หมายเหตุ</Label>
          <Input
            placeholder="หมายเหตุ (ถ้ามี)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex gap-3">
        <Button variant="outline" className="flex-1" onClick={handleClose}>
          ปิด
        </Button>
        <Button
          className="flex-1 bg-red-600 hover:bg-red-700"
          disabled={!isValid || submitting}
          onClick={handleSubmit}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          บันทึกเบิกออก
        </Button>
      </div>

      {/* Item Picker Modal */}
      {showItemPicker && (
        <div className="fixed inset-0 z-50 bg-black/50 flex flex-col">
          <div className="mt-auto bg-white rounded-t-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">เลือกสินค้า</h3>
                <button
                  onClick={() => {
                    setShowItemPicker(false);
                    setItemSearch("");
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  ปิด
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="ค้นหาสินค้า..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  ไม่พบสินค้า
                </div>
              ) : (
                filteredItems.map((item) => {
                  // Show stock level in picker
                  const itemStock = lots
                    .filter((l) => l.item_id === item.id)
                    .reduce((sum, l) => sum + l.remaining_qty, 0);

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedItemId(item.id);
                        setShowItemPicker(false);
                        setItemSearch("");
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 text-left hover:bg-gray-50 transition-colors ${
                        item.id === selectedItemId ? "bg-orange-50" : ""
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          คงเหลือ: {formatNumber(itemStock)}{" "}
                          {item.unit?.name || ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            itemStock <= 0
                              ? "destructive"
                              : itemStock <= item.min_stock
                                ? "warning"
                                : "success"
                          }
                          className="text-xs"
                        >
                          {itemStock <= 0
                            ? "หมด"
                            : itemStock <= item.min_stock
                              ? "ใกล้หมด"
                              : "ปกติ"}
                        </Badge>
                        {item.id === selectedItemId && (
                          <Check className="h-4 w-4 text-orange-500" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
