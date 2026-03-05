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
import {
  PackagePlus,
  Search,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Package,
} from "lucide-react";

interface StockInForm {
  itemId: string;
  branchId: string;
  amount: string;
  unitPrice: string;
  supplierId: string;
  expiryDate: string;
  note: string;
}

const EMPTY_FORM: StockInForm = {
  itemId: "",
  branchId: "",
  amount: "",
  unitPrice: "",
  supplierId: "",
  expiryDate: "",
  note: "",
};

export default function StockInPage() {
  const { items, branches, suppliers, selectedBranchId, fetchAll, loading: masterLoading } = useMasterDataStore();
  const { fetchInventory } = useInventoryStore();
  const { user } = useAuthStore();

  const [form, setForm] = useState<StockInForm>(EMPTY_FORM);
  const [itemSearch, setItemSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [recentTransactions, setRecentTransactions] = useState<Array<{ itemName: string; amount: number; unit: string; time: string }>>([]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Set default branch
  useEffect(() => {
    if (selectedBranchId && !form.branchId) {
      setForm((prev) => ({ ...prev, branchId: selectedBranchId }));
    }
  }, [selectedBranchId, form.branchId]);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === form.itemId),
    [items, form.itemId]
  );

  const totalPrice = useMemo(() => {
    const a = parseFloat(form.amount) || 0;
    const p = parseFloat(form.unitPrice) || 0;
    return a * p;
  }, [form.amount, form.unitPrice]);

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

    setSaving(true);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "in",
          item_id: form.itemId,
          branch_id: form.branchId,
          amount: numAmount,
          unit: selectedItem?.unit?.name || null,
          unit_price: parseFloat(form.unitPrice) || null,
          supplier_id: form.supplierId || null,
          expiry_date: form.expiryDate || null,
          note: form.note,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
        return;
      }

      // Add to recent transactions
      setRecentTransactions((prev) => [
        {
          itemName: selectedItem?.name || "",
          amount: numAmount,
          unit: selectedItem?.unit?.name || "",
          time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
        },
        ...prev.slice(0, 9),
      ]);

      setSuccess(`นำเข้า ${selectedItem?.name} จำนวน ${formatNumber(numAmount)} ${selectedItem?.unit?.name || ""} สำเร็จ`);
      setForm((prev) => ({ ...prev, amount: "", unitPrice: "", supplierId: "", expiryDate: "", note: "" }));

      // Refresh inventory data
      fetchInventory(form.branchId || undefined);

      // Auto-clear success after 3s
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setSaving(false);
    }
  }, [form, selectedItem, fetchInventory]);

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
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
            <PackagePlus className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 lg:text-2xl">นำเข้าสินค้า</h1>
            <p className="text-sm text-gray-500">รับสินค้าเข้าสต็อก</p>
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

            {/* Amount */}
            <div className="space-y-1.5">
              <Label>จำนวน ({selectedItem?.unit?.name || "หน่วย"}) *</Label>
              <Input
                type="number"
                step="any"
                min="0.01"
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </div>

            {/* Price & Supplier */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>ราคาต่อหน่วย (บาท)</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={form.unitPrice}
                  onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>ผู้จัดส่ง</Label>
                <Select value={form.supplierId || "none"} onValueChange={(v) => setForm({ ...form, supplierId: v === "none" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือก" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ไม่ระบุ</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Expiry date */}
            <div className="space-y-1.5">
              <Label>วันหมดอายุ (ถ้ามี)</Label>
              <Input
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
              />
            </div>

            {/* Total value preview */}
            {totalPrice > 0 && (
              <div className="rounded-lg bg-green-50 border border-green-100 p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-green-700">มูลค่ารวม:</span>
                  <span className="font-semibold text-green-800">
                    {formatCurrency(totalPrice)}
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
              <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700" disabled={saving || !form.itemId || !form.branchId || !form.amount}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <PackagePlus className="mr-2 h-4 w-4" />
                    บันทึกนำเข้า
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

      {/* Recent transactions */}
      {recentTransactions.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">รายการนำเข้าล่าสุด (เซสชันนี้)</h3>
            <div className="space-y-2">
              {recentTransactions.map((tx, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <Package className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="flex-1 text-gray-700">
                    {tx.itemName} — {formatNumber(tx.amount)} {tx.unit}
                  </span>
                  <span className="text-xs text-gray-400">{tx.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
