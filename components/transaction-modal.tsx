"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
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
import type { TransactionType, ItemWithRelations } from "@/types/database";
import { formatNumber, formatCurrency, cn } from "@/lib/utils";
import {
  Loader2,
  PackagePlus,
  PackageMinus,
  ArrowRightLeft,
  AlertTriangle,
  Plus,
  Trash2,
  Search,
  ChevronDown,
  CalendarDays,
} from "lucide-react";

// ==================== ItemCombobox ====================

interface ItemComboboxProps {
  value: string;
  onChange: (id: string) => void;
  items: ItemWithRelations[];
  placeholder?: string;
}

function ItemCombobox({ value, onChange, items, placeholder = "เลือกสินค้า" }: ItemComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [rect, setRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => items.find((i) => i.id === value), [items, value]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items.slice(0, 80);
    return items.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 60);
  }, [items, search]);

  const openDropdown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (buttonRef.current) setRect(buttonRef.current.getBoundingClientRect());
    setOpen(true);
    setSearch("");
    setTimeout(() => searchRef.current?.focus(), 30);
  };

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  const selectItem = (id: string) => {
    onChange(id);
    closeDropdown();
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (buttonRef.current?.contains(e.target as Node)) return;
      closeDropdown();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open, closeDropdown]);

  useEffect(() => {
    if (!open) return;
    const handler = () => closeDropdown();
    window.addEventListener("scroll", handler, true);
    return () => window.removeEventListener("scroll", handler, true);
  }, [open, closeDropdown]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={openDropdown}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm",
          "hover:bg-accent/30 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
          !value && "text-muted-foreground"
        )}
      >
        <span className="truncate">{selected?.name || placeholder}</span>
        <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            className="fixed z-[9999] overflow-hidden rounded-md border bg-popover shadow-lg"
            style={{
              top: rect.bottom + 4,
              left: rect.left,
              width: Math.max(rect.width, 260),
              maxHeight: 260,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-3.5 w-3.5 shrink-0 opacity-50" />
              <input
                ref={searchRef}
                className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
                placeholder="ค้นหาสินค้า..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 210 }}>
              {filtered.length === 0 ? (
                <div className="py-5 text-center text-sm text-muted-foreground">ไม่พบสินค้า</div>
              ) : (
                filtered.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex cursor-pointer select-none items-center justify-between px-3 py-2 text-sm",
                      "hover:bg-accent hover:text-accent-foreground",
                      item.id === value && "bg-orange-50 text-orange-700 font-medium"
                    )}
                    onMouseDown={() => selectItem(item.id)}
                  >
                    <span className="truncate">{item.name}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                      {item.unit?.name || ""}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

// ==================== Types ====================

interface ItemRowState {
  id: string; // local key
  item_id: string;
  amount: string;
  unit_price: string; // stock-in only
  expiry_date: string; // stock-in only
  out_reason: string; // stock-out only
}

function createEmptyRow(): ItemRowState {
  return {
    id: Math.random().toString(36).slice(2),
    item_id: "",
    amount: "",
    unit_price: "",
    expiry_date: "",
    out_reason: "ใช้ในร้าน",
  };
}

// ==================== TransactionModal ====================

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

  // Shared state
  const [type, setType] = useState<TransactionType>(defaultType);
  const [branchId, setBranchId] = useState(defaultBranchId || selectedBranchId || "");
  const [targetBranchId, setTargetBranchId] = useState("");
  const [supplierId, setSupplierId] = useState(""); // shared for stock-in
  const [transactionDate, setTransactionDate] = useState(""); // optional
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Item rows
  const [itemRows, setItemRows] = useState<ItemRowState[]>([createEmptyRow()]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setType(defaultType);
      setBranchId(defaultBranchId || selectedBranchId || "");
      setTargetBranchId("");
      setSupplierId("");
      setTransactionDate("");
      setNote("");
      setError("");
      const firstRow = createEmptyRow();
      if (defaultItemId) firstRow.item_id = defaultItemId;
      setItemRows([firstRow]);
    }
  }, [open, defaultType, defaultItemId, defaultBranchId, selectedBranchId]);

  // Reset rows when type changes
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setItemRows([createEmptyRow()]);
    setError("");
  };

  // Stock map: item_id -> total qty for current branch
  const stockByItemId = useMemo(() => {
    if (!branchId) return {} as Record<string, number>;
    return lots.reduce(
      (acc, lot) => {
        if (lot.branch_id === branchId && lot.remaining_qty > 0) {
          acc[lot.item_id] = (acc[lot.item_id] || 0) + lot.remaining_qty;
        }
        return acc;
      },
      {} as Record<string, number>
    );
  }, [lots, branchId]);

  // Total value for stock-in
  const totalInValue = useMemo(() => {
    if (type !== "in") return 0;
    return itemRows.reduce((sum, row) => {
      const qty = parseFloat(row.amount) || 0;
      const price = parseFloat(row.unit_price) || 0;
      return sum + qty * price;
    }, 0);
  }, [type, itemRows]);

  // Row handlers
  const updateRow = (id: string, field: keyof ItemRowState, val: string) => {
    setItemRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r))
    );
  };

  const addRow = () => setItemRows((prev) => [...prev, createEmptyRow()]);

  const removeRow = (id: string) => {
    setItemRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

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

    // Validate rows
    for (const row of itemRows) {
      if (!row.item_id) {
        setError("กรุณาเลือกสินค้าทุกรายการ");
        return;
      }
      const qty = parseFloat(row.amount);
      if (!qty || qty <= 0) {
        setError("กรุณาระบุจำนวนที่ถูกต้องทุกรายการ");
        return;
      }
      if (type === "out" || type === "transfer") {
        const stock = stockByItemId[row.item_id] || 0;
        const itemName = items.find((i) => i.id === row.item_id)?.name || "";
        if (qty > stock) {
          setError(`สต็อกไม่เพียงพอ: ${itemName} (มี ${formatNumber(stock, 2)})`);
          return;
        }
      }
    }

    setLoading(true);
    try {
      // Build batch payload
      const batchItems = itemRows.map((row) => {
        const itemInfo = items.find((i) => i.id === row.item_id);
        return {
          item_id: row.item_id,
          amount: parseFloat(row.amount),
          unit: itemInfo?.unit?.name || null,
          ...(type === "in" && {
            unit_price: parseFloat(row.unit_price) || null,
            expiry_date: row.expiry_date || null,
          }),
          ...(type === "out" && { out_reason: row.out_reason }),
        };
      });

      const payload: Record<string, unknown> = {
        type,
        branch_id: branchId,
        note,
        items: batchItems,
        ...(transactionDate && { transaction_date: transactionDate }),
        ...(type === "in" && supplierId && { supplier_id: supplierId }),
        ...(type === "transfer" && { target_branch_id: targetBranchId }),
      };

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    in: {
      label: "รับเข้า",
      icon: PackagePlus,
      color: "text-green-600",
      bgColor: "bg-green-50",
      activeBg: "bg-white shadow-sm text-green-600",
    },
    out: {
      label: "เบิกออก",
      icon: PackageMinus,
      color: "text-red-600",
      bgColor: "bg-red-50",
      activeBg: "bg-white shadow-sm text-red-600",
    },
    transfer: {
      label: "โอนย้าย",
      icon: ArrowRightLeft,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      activeBg: "bg-white shadow-sm text-blue-600",
    },
  };

  const TypeIcon = typeConfig[type as keyof typeof typeConfig]?.icon || PackagePlus;
  const currentTypeConfig = typeConfig[type as keyof typeof typeConfig];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <div className={`rounded-lg p-1.5 ${currentTypeConfig?.bgColor}`}>
              <TypeIcon className={`h-4 w-4 ${currentTypeConfig?.color}`} />
            </div>
            บันทึกรายการ
          </DialogTitle>
          <DialogDescription>กรอกข้อมูลรายการด้านล่าง สามารถเพิ่มได้หลายรายการต่อครั้ง</DialogDescription>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Type Selector */}
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {(["in", "out", "transfer"] as const).map((t) => {
              const cfg = typeConfig[t];
              const Icon = cfg.icon;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-all",
                    type === t ? cfg.activeBg : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Shared Fields */}
          <div className={cn("grid gap-3", type === "transfer" ? "grid-cols-2" : "grid-cols-1")}>
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
          </div>

          {/* Stock-in shared: supplier + date */}
          {type === "in" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>ผู้จัดส่ง (ใช้กับทุกรายการ)</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="ไม่ระบุ" />
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
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                  วันที่บันทึก (ไม่จำเป็น)
                </Label>
                <Input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Out/Transfer: date only */}
          {(type === "out" || type === "transfer") && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                วันที่บันทึก (ไม่จำเป็น — ถ้าไม่ระบุ ใช้วันนี้)
              </Label>
              <Input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="max-w-[200px]"
              />
            </div>
          )}

          {/* Items Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-gray-700">
                รายการสินค้า ({itemRows.length} รายการ)
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addRow} className="h-7 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" />
                เพิ่มรายการ
              </Button>
            </div>

            {/* Column Headers */}
            <div
              className={cn(
                "hidden sm:grid items-center gap-2 px-2 text-[11px] font-medium text-gray-400 uppercase tracking-wide",
                type === "in" && "grid-cols-[1fr_5rem_6.5rem_8rem_2rem]",
                type === "out" && "grid-cols-[1fr_5rem_8rem_2rem]",
                type === "transfer" && "grid-cols-[1fr_5rem_2rem]"
              )}
            >
              <span>สินค้า</span>
              <span>จำนวน</span>
              {type === "in" && <span>ราคา/หน่วย</span>}
              {type === "in" && <span>วันหมดอายุ</span>}
              {type === "out" && <span>เหตุผล</span>}
              <span />
            </div>

            {/* Item Rows */}
            <div className="space-y-2">
              {itemRows.map((row, idx) => {
                const itemInfo = items.find((i) => i.id === row.item_id);
                const stock = row.item_id ? stockByItemId[row.item_id] || 0 : 0;
                const qty = parseFloat(row.amount) || 0;
                const isStockInsufficient =
                  (type === "out" || type === "transfer") && row.item_id && qty > 0 && qty > stock;

                return (
                  <div
                    key={row.id}
                    className="rounded-lg border border-gray-200 bg-gray-50/50 p-2.5 space-y-2"
                  >
                    {/* Row number on mobile */}
                    <div className="flex items-center justify-between sm:hidden">
                      <span className="text-xs font-medium text-gray-500">รายการที่ {idx + 1}</span>
                      {itemRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Desktop row */}
                    <div
                      className={cn(
                        "items-start gap-2",
                        "hidden sm:grid",
                        type === "in" && "grid-cols-[1fr_5rem_6.5rem_8rem_2rem]",
                        type === "out" && "grid-cols-[1fr_5rem_8rem_2rem]",
                        type === "transfer" && "grid-cols-[1fr_5rem_2rem]"
                      )}
                    >
                      <ItemCombobox
                        value={row.item_id}
                        onChange={(id) => updateRow(row.id, "item_id", id)}
                        items={items}
                      />
                      <Input
                        type="number"
                        step="any"
                        min="0.01"
                        placeholder="0"
                        value={row.amount}
                        onChange={(e) => updateRow(row.id, "amount", e.target.value)}
                        className="h-9 text-sm"
                      />
                      {type === "in" && (
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0.00"
                          value={row.unit_price}
                          onChange={(e) => updateRow(row.id, "unit_price", e.target.value)}
                          className="h-9 text-sm"
                        />
                      )}
                      {type === "in" && (
                        <Input
                          type="date"
                          value={row.expiry_date}
                          onChange={(e) => updateRow(row.id, "expiry_date", e.target.value)}
                          className="h-9 text-sm"
                        />
                      )}
                      {type === "out" && (
                        <Select
                          value={row.out_reason}
                          onValueChange={(v) => updateRow(row.id, "out_reason", v)}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ใช้ในร้าน">ใช้ในร้าน</SelectItem>
                            <SelectItem value="เสียหาย">เสียหาย</SelectItem>
                            <SelectItem value="หมดอายุ">หมดอายุ</SelectItem>
                            <SelectItem value="ลูกค้าซื้อ">ลูกค้าซื้อ</SelectItem>
                            <SelectItem value="อื่นๆ">อื่นๆ</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {itemRows.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="flex h-9 w-8 items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <div className="w-8" />
                      )}
                    </div>

                    {/* Mobile fields */}
                    <div className="sm:hidden space-y-2">
                      <ItemCombobox
                        value={row.item_id}
                        onChange={(id) => updateRow(row.id, "item_id", id)}
                        items={items}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-gray-500 mb-1">
                            จำนวน {itemInfo?.unit?.name ? `(${itemInfo.unit.name})` : ""}
                          </Label>
                          <Input
                            type="number"
                            step="any"
                            min="0.01"
                            placeholder="0"
                            value={row.amount}
                            onChange={(e) => updateRow(row.id, "amount", e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        {type === "in" && (
                          <div>
                            <Label className="text-xs text-gray-500 mb-1">ราคา/หน่วย</Label>
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              placeholder="0.00"
                              value={row.unit_price}
                              onChange={(e) => updateRow(row.id, "unit_price", e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                        )}
                        {type === "out" && (
                          <div>
                            <Label className="text-xs text-gray-500 mb-1">เหตุผล</Label>
                            <Select
                              value={row.out_reason}
                              onValueChange={(v) => updateRow(row.id, "out_reason", v)}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
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
                      </div>
                      {type === "in" && (
                        <div>
                          <Label className="text-xs text-gray-500 mb-1">วันหมดอายุ (ถ้ามี)</Label>
                          <Input
                            type="date"
                            value={row.expiry_date}
                            onChange={(e) => updateRow(row.id, "expiry_date", e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                      )}
                    </div>

                    {/* Stock info for out/transfer */}
                    {(type === "out" || type === "transfer") && row.item_id && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400">คงเหลือ:</span>
                        <span className={cn("font-medium", isStockInsufficient && "text-red-500")}>
                          {formatNumber(stock, 2)} {itemInfo?.unit?.name || ""}
                        </span>
                        {isStockInsufficient && (
                          <span className="flex items-center gap-0.5 text-red-500">
                            <AlertTriangle className="h-3 w-3" />
                            ไม่เพียงพอ
                          </span>
                        )}
                      </div>
                    )}

                    {/* Row total for stock-in */}
                    {type === "in" && row.amount && row.unit_price && (
                      <div className="text-xs text-green-700">
                        มูลค่า:{" "}
                        <span className="font-medium">
                          {formatCurrency((parseFloat(row.amount) || 0) * (parseFloat(row.unit_price) || 0))}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Total for stock-in */}
            {type === "in" && totalInValue > 0 && (
              <div className="rounded-lg bg-green-50 px-4 py-2.5 flex justify-between items-center">
                <span className="text-sm text-green-700 font-medium">มูลค่ารวมทั้งหมด</span>
                <span className="text-base font-bold text-green-800">{formatCurrency(totalInValue)}</span>
              </div>
            )}
          </div>

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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50/50 shrink-0">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-[10px]">
              ผู้ทำรายการ: {user?.username || "-"}
            </Badge>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                ยกเลิก
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !branchId || itemRows.some((r) => !r.item_id || !r.amount)}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <TypeIcon className="h-4 w-4" />
                    บันทึก{currentTypeConfig?.label} ({itemRows.length})
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
