"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useMasterDataStore } from "@/stores/master-data";
import { useInventoryStore } from "@/stores/inventory";
import { useAuthStore } from "@/stores/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { calculateTotalStock, calculateWAC } from "@/lib/utils/fifo";
import {
  PackageMinus,
  Search,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Package,
} from "lucide-react";

interface StockOutForm {
  itemId: string;
  branchId: string;
  amount: string;
  outReason: string;
  note: string;
}

const EMPTY_FORM: StockOutForm = {
  itemId: "",
  branchId: "",
  amount: "",
  outReason: "",
  note: "",
};

const OUT_REASONS = [
  { value: "ใช้ในร้าน", label: "ใช้ในร้าน" },
  { value: "เสียหาย", label: "เสียหาย" },
  { value: "หมดอายุ", label: "หมดอายุ" },
  { value: "ลูกค้าซื้อ", label: "ลูกค้าซื้อ" },
  { value: "อื่นๆ", label: "อื่นๆ" },
];

export default function StockOutPage() {
  const { items, branches, selectedBranchId, fetchAll, loading: masterLoading } = useMasterDataStore();
  const { lots, fetchInventory } = useInventoryStore();
  const { user } = useAuthStore();

  const [form, setForm] = useState<StockOutForm>(EMPTY_FORM);
  const [itemSearch, setItemSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [recentOuts, setRecentOuts] = useState<Array<{ itemName: string; amount: number; unit: string; reason: string; time: string }>>([]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Set default branch
  useEffect(() => {
    if (selectedBranchId && !form.branchId) {
      setForm((prev) => ({ ...prev, branchId: selectedBranchId }));
    }
  }, [selectedBranchId, form.branchId]);

  // Fetch inventory when branch changes
  useEffect(() => {
    if (form.branchId) {
      fetchInventory(form.branchId);
    }
  }, [form.branchId, fetchInventory]);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === form.itemId),
    [items, form.itemId]
  );

  // Current stock
  const currentStock = useMemo(() => {
    if (!form.itemId || !form.branchId) return 0;
    const itemLots = lots.filter(
      (l) => l.item_id === form.itemId && l.branch_id === form.branchId && l.remaining_qty > 0
    );
    return calculateTotalStock(itemLots);
  }, [lots, form.itemId, form.branchId]);

  const currentWAC = useMemo(() => {
    if (!form.itemId || !form.branchId) return 0;
    const itemLots = lots.filter(
      (l) => l.item_id === form.itemId && l.branch_id === form.branchId && l.remaining_qty > 0
    );
    return calculateWAC(itemLots);
  }, [lots, form.itemId, form.branchId]);

  const estimatedValue = useMemo(() => {
    const a = parseFloat(form.amount) || 0;
    return a * currentWAC;
  }, [form.amount, currentWAC]);

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return items;
    const q = itemSearch.trim().toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, itemSearch]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const numAmount = parseFloat(form.amount);
    if (!numAmount || numAmount <= 0) {
      setError("กรุณาระบุจำนวนที่ถูกต้อง");
      return;
    }
    if (!form.itemId) {
      setError("กรุณาเลือกสินค้า");
      return;
    }
    if (!form.branchId) {
      setError("กรุณาเลือกสาขา");
      return;
    }
    if (numAmount > currentStock) {
      setError(`สต็อกไม่เพียงพอ (มี ${formatNumber(currentStock)} ${selectedItem?.unit?.name || ""})`);
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "out",
          item_id: form.itemId,
          branch_id: form.branchId,
          amount: numAmount,
          unit: selectedItem?.unit?.name || null,
          out_reason: form.outReason,
          note: form.note,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
        return;
      }

      // Add to recent
      setRecentOuts((prev) => [
        {
          itemName: selectedItem?.name || "",
          amount: numAmount,
          unit: selectedItem?.unit?.name || "",
          reason: form.outReason || "-",
          time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
        },
        ...prev.slice(0, 9),
      ]);

      setSuccess(`เบิก ${selectedItem?.name} จำนวน ${formatNumber(numAmount)} ${selectedItem?.unit?.name || ""} สำเร็จ`);
      setForm((prev) => ({ ...prev, amount: "", outReason: "", note: "" }));

      // Refresh inventory data
      fetchInventory(form.branchId || undefined);

      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setSaving(false);
    }
  }, [form, selectedItem, currentStock, fetchInventory]);

  if (masterLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100">
            <PackageMinus className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 lg:text-2xl">เบิกสินค้า</h1>
            <p className="text-sm text-gray-500">เบิกสินค้าออกจากสต็อก</p>
          </div>
        </div>
      </div>

      {/* Success message */}
      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Form */}
      <Card>
        <CardContent className="p-4 lg:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Item select */}
            <div className="space-y-1.5">
              <Label>สินค้า *</Label>
              <Select value={form.itemId} onValueChange={(v) => setForm({ ...form, itemId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกสินค้า" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                      <input
                        className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-8 pr-8 text-sm outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
                        placeholder="ค้นหาสินค้า..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                      {itemSearch && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setItemSearch(""); }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {filteredItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex items-center gap-2">
                        <span>{item.name}</span>
                        {item.unit?.name && (
                          <span className="text-xs text-gray-400">({item.unit.name})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                  {filteredItems.length === 0 && (
                    <div className="py-4 text-center text-sm text-gray-400">ไม่พบสินค้า</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Branch */}
            <div className="space-y-1.5">
              <Label>สาขา *</Label>
              <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกสาขา" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} {b.is_hq ? "(สำนักงานใหญ่)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Current stock info */}
            {form.itemId && form.branchId && (
              <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-red-700">สต็อกปัจจุบัน:</span>
                  <span className="font-semibold text-red-800">
                    {formatNumber(currentStock, 2)} {selectedItem?.unit?.name || ""}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-red-600">ต้นทุนเฉลี่ย (WAC):</span>
                  <span className="font-medium text-red-800">{formatCurrency(currentWAC)}</span>
                </div>
                {currentStock === 0 && (
                  <div className="mt-2 flex items-center gap-1.5 text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span className="text-xs">ไม่มีสต็อกเหลือ</span>
                  </div>
                )}
                {currentStock > 0 && currentStock < (selectedItem?.min_stock || 0) && (
                  <div className="mt-2 flex items-center gap-1.5 text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span className="text-xs">สต็อกต่ำกว่าขั้นต่ำ ({formatNumber(selectedItem?.min_stock || 0)})</span>
                  </div>
                )}
              </div>
            )}

            {/* Amount */}
            <div className="space-y-1.5">
              <Label>จำนวนที่เบิก ({selectedItem?.unit?.name || "หน่วย"}) *</Label>
              <Input
                type="number"
                step="any"
                min="0.01"
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
              {form.amount && parseFloat(form.amount) > currentStock && currentStock > 0 && (
                <p className="text-xs text-red-500 mt-1">
                  จำนวนมากกว่าสต็อกที่มี ({formatNumber(currentStock)} {selectedItem?.unit?.name || ""})
                </p>
              )}
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label>เหตุผลในการเบิก</Label>
              <Select value={form.outReason || "none"} onValueChange={(v) => setForm({ ...form, outReason: v === "none" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกเหตุผล" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ไม่ระบุ</SelectItem>
                  {OUT_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estimated value */}
            {estimatedValue > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-amber-700">มูลค่าโดยประมาณ (WAC):</span>
                  <span className="font-semibold text-amber-800">
                    {formatCurrency(estimatedValue)}
                  </span>
                </div>
              </div>
            )}

            {/* Note */}
            <div className="space-y-1.5">
              <Label>หมายเหตุ</Label>
              <Textarea
                placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                rows={2}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={saving || !form.itemId || !form.branchId || !form.amount}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <PackageMinus className="mr-2 h-4 w-4" />
                    บันทึกเบิกสินค้า
                  </>
                )}
              </Button>
            </div>

            {/* Performer info */}
            <div className="text-center pt-1">
              <Badge variant="secondary" className="text-[10px]">
                ผู้ทำรายการ: {user?.username || "-"}
              </Badge>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Recent stock-outs */}
      {recentOuts.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">รายการเบิกล่าสุด (เซสชันนี้)</h3>
            <div className="space-y-2">
              {recentOuts.map((tx, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <PackageMinus className="h-4 w-4 text-red-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-gray-700">
                      {tx.itemName} — {formatNumber(tx.amount)} {tx.unit}
                    </span>
                    {tx.reason !== "-" && (
                      <p className="text-xs text-gray-400">เหตุผล: {tx.reason}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{tx.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
