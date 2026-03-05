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
  ArrowRightLeft,
  Search,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Package,
  Building2,
} from "lucide-react";

interface TransferForm {
  itemId: string;
  sourceBranchId: string;
  targetBranchId: string;
  amount: string;
  note: string;
}

const EMPTY_FORM: TransferForm = {
  itemId: "",
  sourceBranchId: "",
  targetBranchId: "",
  amount: "",
  note: "",
};

export default function TransferPage() {
  const { items, branches, selectedBranchId, fetchAll, loading: masterLoading } = useMasterDataStore();
  const { lots, fetchInventory } = useInventoryStore();
  const { user } = useAuthStore();

  const [form, setForm] = useState<TransferForm>(EMPTY_FORM);
  const [itemSearch, setItemSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [recentTransfers, setRecentTransfers] = useState<Array<{ itemName: string; amount: number; unit: string; from: string; to: string; time: string }>>([]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Set default source branch
  useEffect(() => {
    if (selectedBranchId && !form.sourceBranchId) {
      setForm((prev) => ({ ...prev, sourceBranchId: selectedBranchId }));
    }
  }, [selectedBranchId, form.sourceBranchId]);

  // Fetch inventory when source branch changes
  useEffect(() => {
    if (form.sourceBranchId) {
      fetchInventory(form.sourceBranchId);
    }
  }, [form.sourceBranchId, fetchInventory]);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === form.itemId),
    [items, form.itemId]
  );

  // Current stock at source branch
  const currentStock = useMemo(() => {
    if (!form.itemId || !form.sourceBranchId) return 0;
    const itemLots = lots.filter(
      (l) => l.item_id === form.itemId && l.branch_id === form.sourceBranchId && l.remaining_qty > 0
    );
    return calculateTotalStock(itemLots);
  }, [lots, form.itemId, form.sourceBranchId]);

  const currentWAC = useMemo(() => {
    if (!form.itemId || !form.sourceBranchId) return 0;
    const itemLots = lots.filter(
      (l) => l.item_id === form.itemId && l.branch_id === form.sourceBranchId && l.remaining_qty > 0
    );
    return calculateWAC(itemLots);
  }, [lots, form.itemId, form.sourceBranchId]);

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return items;
    const q = itemSearch.trim().toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, itemSearch]);

  const availableTargetBranches = useMemo(
    () => branches.filter((b) => b.id !== form.sourceBranchId),
    [branches, form.sourceBranchId]
  );

  const sourceBranchName = useMemo(
    () => branches.find((b) => b.id === form.sourceBranchId)?.name || "",
    [branches, form.sourceBranchId]
  );

  const targetBranchName = useMemo(
    () => branches.find((b) => b.id === form.targetBranchId)?.name || "",
    [branches, form.targetBranchId]
  );

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
    if (!form.sourceBranchId) {
      setError("กรุณาเลือกสาขาต้นทาง");
      return;
    }
    if (!form.targetBranchId) {
      setError("กรุณาเลือกสาขาปลายทาง");
      return;
    }
    if (form.sourceBranchId === form.targetBranchId) {
      setError("สาขาต้นทางและปลายทางต้องไม่ซ้ำกัน");
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
          type: "transfer",
          item_id: form.itemId,
          branch_id: form.sourceBranchId,
          target_branch_id: form.targetBranchId,
          amount: numAmount,
          unit: selectedItem?.unit?.name || null,
          note: form.note,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
        return;
      }

      // Add to recent transfers
      setRecentTransfers((prev) => [
        {
          itemName: selectedItem?.name || "",
          amount: numAmount,
          unit: selectedItem?.unit?.name || "",
          from: sourceBranchName,
          to: targetBranchName,
          time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
        },
        ...prev.slice(0, 9),
      ]);

      setSuccess(`โอนย้าย ${selectedItem?.name} จำนวน ${formatNumber(numAmount)} ${selectedItem?.unit?.name || ""} จาก ${sourceBranchName} ไป ${targetBranchName} สำเร็จ`);
      setForm((prev) => ({ ...prev, amount: "", note: "" }));

      // Refresh inventory data
      fetchInventory(form.sourceBranchId || undefined);

      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setSaving(false);
    }
  }, [form, selectedItem, currentStock, sourceBranchName, targetBranchName, fetchInventory]);

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
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
            <ArrowRightLeft className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 lg:text-2xl">โอนย้ายสินค้า</h1>
            <p className="text-sm text-gray-500">โอนสินค้าระหว่างสาขา</p>
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

            {/* Source & Target Branch */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-gray-400" />
                  สาขาต้นทาง *
                </Label>
                <Select value={form.sourceBranchId} onValueChange={(v) => {
                  setForm({ ...form, sourceBranchId: v, targetBranchId: form.targetBranchId === v ? "" : form.targetBranchId });
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกสาขาต้นทาง" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} {b.is_hq ? "(HQ)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <ArrowRightLeft className="h-3.5 w-3.5 text-gray-400" />
                  สาขาปลายทาง *
                </Label>
                <Select value={form.targetBranchId} onValueChange={(v) => setForm({ ...form, targetBranchId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกสาขาปลายทาง" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTargetBranches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} {b.is_hq ? "(HQ)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Current stock info */}
            {form.itemId && form.sourceBranchId && (
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700">สต็อกปัจจุบัน ({sourceBranchName}):</span>
                  <span className="font-semibold text-blue-800">
                    {formatNumber(currentStock, 2)} {selectedItem?.unit?.name || ""}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-blue-600">ต้นทุนเฉลี่ย (WAC):</span>
                  <span className="font-medium text-blue-800">{formatCurrency(currentWAC)}</span>
                </div>
                {currentStock === 0 && (
                  <div className="mt-2 flex items-center gap-1.5 text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span className="text-xs">ไม่มีสต็อกที่สาขานี้</span>
                  </div>
                )}
              </div>
            )}

            {/* Amount */}
            <div className="space-y-1.5">
              <Label>จำนวนที่ต้องการโอน ({selectedItem?.unit?.name || "หน่วย"}) *</Label>
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
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={saving || !form.itemId || !form.sourceBranchId || !form.targetBranchId || !form.amount}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังโอนย้าย...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    บันทึกโอนย้าย
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

      {/* Recent transfers */}
      {recentTransfers.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">รายการโอนย้ายล่าสุด (เซสชันนี้)</h3>
            <div className="space-y-2">
              {recentTransfers.map((tx, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <ArrowRightLeft className="h-4 w-4 text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-gray-700">
                      {tx.itemName} — {formatNumber(tx.amount)} {tx.unit}
                    </span>
                    <p className="text-xs text-gray-400">
                      {tx.from} → {tx.to}
                    </p>
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
