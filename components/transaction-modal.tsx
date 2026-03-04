"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useMasterDataStore } from "@/stores/master-data";
import { useInventoryStore } from "@/stores/inventory";
import { useAuthStore } from "@/stores/auth";
import type { TransactionType } from "@/types/database";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { calculateTotalStock, calculateWAC } from "@/lib/utils/fifo";
import {
  Loader2,
  PackagePlus,
  PackageMinus,
  ArrowRightLeft,
  AlertTriangle,
} from "lucide-react";

interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
  defaultType?: TransactionType;
  defaultItemId?: string;
  defaultBranchId?: string;
  onSuccess?: () => void;
}

export function TransactionModal({
  open,
  onClose,
  defaultType = "in",
  defaultItemId,
  defaultBranchId,
  onSuccess,
}: TransactionModalProps) {
  const { items, branches, suppliers, selectedBranchId } = useMasterDataStore();
  const { lots } = useInventoryStore();
  const { user } = useAuthStore();

  const [type, setType] = useState<TransactionType>(defaultType);
  const [itemId, setItemId] = useState(defaultItemId || "");
  const [branchId, setBranchId] = useState(defaultBranchId || selectedBranchId || "");
  const [targetBranchId, setTargetBranchId] = useState("");
  const [amount, setAmount] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [outReason, setOutReason] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setType(defaultType);
      setItemId(defaultItemId || "");
      setBranchId(defaultBranchId || selectedBranchId || "");
      setTargetBranchId("");
      setAmount("");
      setUnitPrice("");
      setSupplierId("");
      setExpiryDate("");
      setOutReason("");
      setNote("");
      setError("");
    }
  }, [open, defaultType, defaultItemId, defaultBranchId, selectedBranchId]);

  // Selected item info
  const selectedItem = useMemo(
    () => items.find((i) => i.id === itemId),
    [items, itemId]
  );

  // Current stock for selected item+branch
  const currentStock = useMemo(() => {
    if (!itemId || !branchId) return 0;
    const itemLots = lots.filter(
      (l) => l.item_id === itemId && l.branch_id === branchId && l.remaining_qty > 0
    );
    return calculateTotalStock(itemLots);
  }, [lots, itemId, branchId]);

  const currentWAC = useMemo(() => {
    if (!itemId || !branchId) return 0;
    const itemLots = lots.filter(
      (l) => l.item_id === itemId && l.branch_id === branchId && l.remaining_qty > 0
    );
    return calculateWAC(itemLots);
  }, [lots, itemId, branchId]);

  const totalPrice = useMemo(() => {
    const a = parseFloat(amount) || 0;
    const p = parseFloat(unitPrice) || 0;
    return a * p;
  }, [amount, unitPrice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError("กรุณาระบุจำนวนที่ถูกต้อง");
      return;
    }

    if (!itemId) {
      setError("กรุณาเลือกสินค้า");
      return;
    }

    if (!branchId) {
      setError("กรุณาเลือกสาขา");
      return;
    }

    if (type === "transfer" && !targetBranchId) {
      setError("กรุณาเลือกสาขาปลายทาง");
      return;
    }

    if (type === "transfer" && branchId === targetBranchId) {
      setError("สาขาต้นทางและปลายทางต้องไม่ซ้ำกัน");
      return;
    }

    if ((type === "out" || type === "transfer") && numAmount > currentStock) {
      setError(`สต็อกไม่เพียงพอ (มี ${formatNumber(currentStock)} ${selectedItem?.unit?.name || ""})`);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          item_id: itemId,
          branch_id: branchId,
          target_branch_id: type === "transfer" ? targetBranchId : null,
          amount: numAmount,
          unit: selectedItem?.unit?.name || null,
          unit_price: type === "in" ? parseFloat(unitPrice) || null : null,
          supplier_id: type === "in" ? supplierId || null : null,
          expiry_date: type === "in" ? expiryDate || null : null,
          out_reason: type === "out" ? outReason : "",
          note,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
        setLoading(false);
        return;
      }

      onSuccess?.();
      onClose();
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setLoading(false);
    }
  };

  const typeConfig = {
    in: { label: "รับเข้า", icon: PackagePlus, color: "text-green-600", bgColor: "bg-green-50" },
    out: { label: "เบิกออก", icon: PackageMinus, color: "text-red-600", bgColor: "bg-red-50" },
    transfer: { label: "โอนย้าย", icon: ArrowRightLeft, color: "text-blue-600", bgColor: "bg-blue-50" },
    adjust: { label: "ปรับยอด", icon: AlertTriangle, color: "text-orange-600", bgColor: "bg-orange-50" },
  };

  const TypeIcon = typeConfig[type].icon;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`rounded-lg p-1.5 ${typeConfig[type].bgColor}`}>
              <TypeIcon className={`h-4 w-4 ${typeConfig[type].color}`} />
            </div>
            บันทึกรายการ
          </DialogTitle>
          <DialogDescription>เลือกประเภทและกรอกข้อมูลด้านล่าง</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transaction type selector */}
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {(["in", "out", "transfer"] as TransactionType[]).map((t) => {
              const config = typeConfig[t];
              const Icon = config.icon;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-all ${
                    type === t
                      ? "bg-white shadow-sm " + config.color
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {config.label}
                </button>
              );
            })}
          </div>

          {/* Item select */}
          <div className="space-y-1.5">
            <Label>สินค้า</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกสินค้า" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} {item.unit?.name ? `(${item.unit.name})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Branch */}
          <div className="space-y-1.5">
            <Label>{type === "transfer" ? "สาขาต้นทาง" : "สาขา"}</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกสาขา" />
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

          {/* Target branch for transfer */}
          {type === "transfer" && (
            <div className="space-y-1.5">
              <Label>สาขาปลายทาง</Label>
              <Select value={targetBranchId} onValueChange={setTargetBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกสาขาปลายทาง" />
                </SelectTrigger>
                <SelectContent>
                  {branches
                    .filter((b) => b.id !== branchId)
                    .map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} {b.is_hq ? "(HQ)" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Current stock info */}
          {itemId && branchId && (type === "out" || type === "transfer") && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">สต็อกปัจจุบัน:</span>
                <span className="font-medium">
                  {formatNumber(currentStock, 2)} {selectedItem?.unit?.name || ""}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-gray-500">ต้นทุนเฉลี่ย (WAC):</span>
                <span className="font-medium">{formatCurrency(currentWAC)}</span>
              </div>
              {currentStock < (selectedItem?.min_stock || 0) && (
                <div className="mt-2 flex items-center gap-1.5 text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-xs">สต็อกต่ำกว่าขั้นต่ำ ({formatNumber(selectedItem?.min_stock || 0)})</span>
                </div>
              )}
            </div>
          )}

          {/* Amount */}
          <div className="space-y-1.5">
            <Label>จำนวน ({selectedItem?.unit?.name || "หน่วย"})</Label>
            <Input
              type="number"
              step="any"
              min="0.01"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          {/* Stock IN specific fields */}
          {type === "in" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>ราคาต่อหน่วย</Label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>ผู้จัดส่ง</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือก" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>วันหมดอายุ (ถ้ามี)</Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>

              {totalPrice > 0 && (
                <div className="rounded-lg bg-green-50 p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700">มูลค่ารวม:</span>
                    <span className="font-semibold text-green-800">
                      {formatCurrency(totalPrice)}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Stock OUT specific fields */}
          {type === "out" && (
            <div className="space-y-1.5">
              <Label>เหตุผล</Label>
              <Select value={outReason} onValueChange={setOutReason}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกเหตุผล" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ใช้ในร้าน">ใช้ในร้าน</SelectItem>
                  <SelectItem value="เสียหาย">เสียหาย</SelectItem>
                  <SelectItem value="หมดอายุ">หมดอายุ</SelectItem>
                  <SelectItem value="ลูกค้าซื้อ">ลูกค้าซื้อ</SelectItem>
                  <SelectItem value="อื่นๆ">อื่นๆ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Note */}
          <div className="space-y-1.5">
            <Label>หมายเหตุ</Label>
            <Textarea
              placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Footer */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={loading || !itemId || !branchId || !amount}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <TypeIcon className="h-4 w-4" />
                  บันทึก{typeConfig[type].label}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>

        {/* User info */}
        <div className="border-t border-gray-100 pt-3 text-center">
          <Badge variant="secondary" className="text-[10px]">
            ผู้ทำรายการ: {user?.username || "-"}
          </Badge>
        </div>
      </DialogContent>
    </Dialog>
  );
}
