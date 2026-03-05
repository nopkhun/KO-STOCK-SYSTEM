"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuthStore } from "@/stores/auth";
import { useMasterDataStore } from "@/stores/master-data";
import { useInventoryStore } from "@/stores/inventory";
import { cn, formatNumber, formatCurrency } from "@/lib/utils";
import { calculateRecommendedPrice, calculateRecommendedMinStock } from "@/lib/utils/stock-recommendations";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem as SelectOption,
} from "@/components/ui/select";
import type { ItemWithRelations, ItemSupplier } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  BoxSelect,
  Package,
  X,
  AlertTriangle,
  Lightbulb,
  Truck,
  TrendingUp,
} from "lucide-react";

interface ItemForm {
  name: string;
  unit_id: string;
  category_id: string;
  min_stock: string;
  custom_price: string;
  custom_price_unit: string;
}

interface SupplierMapping {
  supplier_id: string;
  name_at_supplier: string;
}

const EMPTY_FORM: ItemForm = {
  name: "",
  unit_id: "",
  category_id: "",
  min_stock: "0",
  custom_price: "",
  custom_price_unit: "บาท/กก.",
};

export default function ItemsPage() {
  const { isAdmin } = useAuthStore();
  const { items, units, categories, suppliers, fetchAll, loading: masterLoading } = useMasterDataStore();
  const { lots, fetchInventory, loading: invLoading } = useInventoryStore();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemWithRelations | null>(null);
  const [deletingItem, setDeletingItem] = useState<ItemWithRelations | null>(null);
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM);
  const [supplierMappings, setSupplierMappings] = useState<SupplierMapping[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  // Out-transactions for min stock recommendations
  const [outTransactions, setOutTransactions] = useState<
    Array<{ item_id: string; amount: number; created_at: string }>
  >([]);

  const canEdit = isAdmin();

  useEffect(() => {
    fetchAll();
    fetchInventory();
    // Fetch out-transactions for min stock recommendation (last 90 days)
    const fetchOutTransactions = async () => {
      try {
        const supabase = createClient();
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const { data } = await supabase
          .from("transactions")
          .select("item_id, amount, created_at")
          .eq("type", "out")
          .gte("created_at", ninetyDaysAgo.toISOString())
          .order("created_at", { ascending: false });

        if (data) {
          setOutTransactions(data);
        }
      } catch {
        // silent - recommendations will just not show
      }
    };
    fetchOutTransactions();
  }, [fetchAll, fetchInventory]);

  // Calculate recommended prices (WAC) per item from inventory lots
  const recommendedPrices = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const itemLots = lots.filter(
        (l) => l.item_id === item.id && l.remaining_qty > 0
      );
      const wac = calculateRecommendedPrice(itemLots);
      if (wac !== null) {
        map.set(item.id, wac);
      }
    }
    return map;
  }, [items, lots]);

  // Calculate recommended min stock per item from out-transactions
  const recommendedMinStocks = useMemo(() => {
    const map = new Map<string, { value: number; avgDailyUsage: number; daysOfData: number }>();
    for (const item of items) {
      const itemTx = outTransactions.filter((t) => t.item_id === item.id);
      const rec = calculateRecommendedMinStock(itemTx, 5);
      if (rec !== null) {
        map.set(item.id, rec);
      }
    }
    return map;
  }, [items, outTransactions]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (categoryFilter !== "all" && item.category_id !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!item.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, categoryFilter, search]);

  const openCreateDialog = () => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setSupplierMappings([]);
    setError("");
    setFormOpen(true);
  };

  const openEditDialog = (item: ItemWithRelations) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      unit_id: item.unit_id || "",
      category_id: item.category_id || "",
      min_stock: String(item.min_stock),
      custom_price: item.custom_price != null ? String(item.custom_price) : "",
      custom_price_unit: item.custom_price_unit || "บาท/กก.",
    });
    // Load existing supplier mappings
    setSupplierMappings(
      (item.item_suppliers || []).map((is) => ({
        supplier_id: is.supplier_id,
        name_at_supplier: is.name_at_supplier || "",
      }))
    );
    setError("");
    setFormOpen(true);
  };

  const openDeleteDialog = (item: ItemWithRelations) => {
    setDeletingItem(item);
    setDeleteOpen(true);
  };

  // Get recommended values for the current editing/creating item
  const currentRecommendedPrice = editingItem
    ? recommendedPrices.get(editingItem.id)
    : undefined;
  const currentRecommendedMinStock = editingItem
    ? recommendedMinStocks.get(editingItem.id)
    : undefined;

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("กรุณาระบุชื่อสินค้า");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const supabase = createClient();
      const payload = {
        name: form.name.trim(),
        unit_id: form.unit_id || null,
        category_id: form.category_id || null,
        min_stock: Number(form.min_stock) || 0,
        custom_price: form.custom_price ? Number(form.custom_price) : null,
        custom_price_unit: form.custom_price_unit || "บาท/กก.",
      };

      let itemId: string;

      if (editingItem) {
        const { error: err } = await supabase
          .from("items")
          .update(payload)
          .eq("id", editingItem.id);
        if (err) throw err;
        itemId = editingItem.id;
      } else {
        const { data: inserted, error: err } = await supabase
          .from("items")
          .insert(payload)
          .select("id")
          .single();
        if (err) throw err;
        itemId = inserted.id;
      }

      // Save supplier mappings
      if (editingItem) {
        // Delete existing mappings and re-insert
        await supabase
          .from("item_suppliers")
          .delete()
          .eq("item_id", itemId);
      }

      if (supplierMappings.length > 0) {
        const validMappings = supplierMappings.filter((m) => m.supplier_id);
        if (validMappings.length > 0) {
          const { error: supErr } = await supabase
            .from("item_suppliers")
            .insert(
              validMappings.map((m) => ({
                item_id: itemId,
                supplier_id: m.supplier_id,
                name_at_supplier: m.name_at_supplier || "",
              }))
            );
          if (supErr) {
            console.error("Error saving supplier mappings:", supErr);
          }
        }
      }

      setFormOpen(false);
      await fetchAll();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;

    setDeleting(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from("items").delete().eq("id", deletingItem.id);
      if (err) throw err;
      setDeleteOpen(false);
      setDeletingItem(null);
      await fetchAll();
    } catch {
      // silent - could show toast
    } finally {
      setDeleting(false);
    }
  };

  // Supplier mapping helpers
  const addSupplierMapping = () => {
    setSupplierMappings([...supplierMappings, { supplier_id: "", name_at_supplier: "" }]);
  };

  const removeSupplierMapping = (index: number) => {
    setSupplierMappings(supplierMappings.filter((_, i) => i !== index));
  };

  const updateSupplierMapping = (index: number, field: keyof SupplierMapping, value: string) => {
    const updated = [...supplierMappings];
    updated[index] = { ...updated[index], [field]: value };
    setSupplierMappings(updated);
  };

  // Get supplier name by id
  const getSupplierName = useCallback(
    (supplierId: string) => {
      return suppliers.find((s) => s.id === supplierId)?.name || "";
    },
    [suppliers]
  );

  // Available suppliers for dropdown (exclude already selected)
  const getAvailableSuppliers = (currentIndex: number) => {
    const usedIds = supplierMappings
      .filter((_, i) => i !== currentIndex)
      .map((m) => m.supplier_id);
    return suppliers.filter((s) => !usedIds.includes(s.id));
  };

  if (masterLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">รายการสินค้า</h1>
          <p className="text-sm text-gray-500">{filtered.length} รายการ</p>
        </div>
        {canEdit && (
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            เพิ่มสินค้า
          </Button>
        )}
      </div>

      {/* Search & Category Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="ค้นหาสินค้า..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40 shrink-0">
            <SelectValue placeholder="หมวดหมู่" />
          </SelectTrigger>
          <SelectContent>
            <SelectOption value="all">ทุกหมวดหมู่</SelectOption>
            {categories.map((cat) => (
              <SelectOption key={cat.id} value={cat.id}>
                {cat.name}
              </SelectOption>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Items List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-16">
          <BoxSelect className="h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-500">ไม่พบสินค้า</p>
          <p className="text-xs text-gray-400">
            {search || categoryFilter !== "all"
              ? "ลองปรับเงื่อนไขการค้นหา"
              : "เริ่มเพิ่มสินค้าใหม่"}
          </p>
          {canEdit && !search && categoryFilter === "all" && (
            <Button variant="ghost" size="sm" className="mt-3" onClick={openCreateDialog}>
              <Plus className="mr-1.5 h-4 w-4" />
              เพิ่มสินค้า
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">ชื่อสินค้า</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">หน่วย</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">หมวดหมู่</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">ผู้จัดส่ง</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">
                    <div className="flex items-center justify-end gap-1">
                      สต็อกขั้นต่ำ
                      <span className="text-[10px] text-gray-400" title="ค่าแนะนำจากข้อมูลการใช้งาน">(แนะนำ)</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">
                    <div className="flex items-center justify-end gap-1">
                      ราคา
                      <span className="text-[10px] text-gray-400" title="WAC = ต้นทุนเฉลี่ยถ่วงน้ำหนัก">(WAC)</span>
                    </div>
                  </th>
                  {canEdit && (
                    <th className="px-4 py-3 text-right font-medium text-gray-500 w-24">จัดการ</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((item) => {
                  const recPrice = recommendedPrices.get(item.id);
                  const recMinStock = recommendedMinStocks.get(item.id);
                  const itemSuppliers = item.item_suppliers || [];

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
                            <Package className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-gray-900">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {item.unit?.name || "-"}
                      </td>
                      <td className="px-4 py-3">
                        {item.category ? (
                          <Badge variant="secondary" className="text-[11px]">
                            {item.category.name}
                          </Badge>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {itemSuppliers.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {itemSuppliers.map((is) => (
                              <Badge
                                key={is.supplier_id}
                                variant="outline"
                                className="text-[10px] border-blue-200 text-blue-600"
                                title={is.name_at_supplier ? `ชื่อที่ผู้จัดส่ง: ${is.name_at_supplier}` : ""}
                              >
                                <Truck className="mr-0.5 h-2.5 w-2.5" />
                                {getSupplierName(is.supplier_id)}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="font-mono tabular-nums text-gray-600">
                            {formatNumber(item.min_stock, 2)}
                          </span>
                          {recMinStock && (
                            <span
                              className="text-[10px] text-amber-500"
                              title={`เฉลี่ย ${formatNumber(recMinStock.avgDailyUsage, 1)}/วัน x 5 วัน (ข้อมูล ${recMinStock.daysOfData} วัน)`}
                            >
                              แนะนำ: {formatNumber(recMinStock.value, 1)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          {item.custom_price != null ? (
                            <span>
                              {formatNumber(item.custom_price, 2)}{" "}
                              <span className="text-xs text-gray-400">{item.custom_price_unit}</span>
                            </span>
                          ) : recPrice ? (
                            <span className="text-gray-500">
                              {formatNumber(recPrice, 2)}{" "}
                              <span className="text-xs text-gray-400">บาท</span>
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                          {recPrice != null && (
                            <span className="text-[10px] text-emerald-500" title="ต้นทุนเฉลี่ยถ่วงน้ำหนักจาก lot คงเหลือ">
                              WAC: {formatNumber(recPrice, 2)}
                            </span>
                          )}
                        </div>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditDialog(item)}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => openDeleteDialog(item)}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-2 lg:hidden">
            {filtered.map((item) => {
              const recPrice = recommendedPrices.get(item.id);
              const recMinStock = recommendedMinStocks.get(item.id);
              const itemSuppliers = item.item_suppliers || [];

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-gray-200 bg-white p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
                      <Package className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-gray-900 truncate">{item.name}</h3>
                        {item.category && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {item.category.name}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
                        {item.unit && <span>หน่วย: {item.unit.name}</span>}
                        <span>
                          ขั้นต่ำ: {formatNumber(item.min_stock, 2)}
                          {recMinStock && (
                            <span className="text-amber-500 ml-1">(แนะนำ {formatNumber(recMinStock.value, 1)})</span>
                          )}
                        </span>
                        {item.custom_price != null ? (
                          <span>ราคา: {formatNumber(item.custom_price, 2)} {item.custom_price_unit}</span>
                        ) : recPrice ? (
                          <span className="text-emerald-500">WAC: {formatNumber(recPrice, 2)} บาท</span>
                        ) : null}
                      </div>
                      {/* Supplier badges on mobile */}
                      {itemSuppliers.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {itemSuppliers.map((is) => (
                            <Badge
                              key={is.supplier_id}
                              variant="outline"
                              className="text-[10px] border-blue-200 text-blue-600"
                            >
                              <Truck className="mr-0.5 h-2.5 w-2.5" />
                              {getSupplierName(is.supplier_id)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => openEditDialog(item)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openDeleteDialog(item)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "แก้ไขข้อมูลสินค้าด้านล่าง"
                : "กรอกข้อมูลสินค้าที่ต้องการเพิ่ม"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="item-name">ชื่อสินค้า *</Label>
              <Input
                id="item-name"
                placeholder="เช่น หมูสามชั้น"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* Unit & Category */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>หน่วย</Label>
                <Select
                  value={form.unit_id || "none"}
                  onValueChange={(v) => setForm({ ...form, unit_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกหน่วย" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectOption value="none">ไม่ระบุ</SelectOption>
                    {units.map((u) => (
                      <SelectOption key={u.id} value={u.id}>
                        {u.name}
                      </SelectOption>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>หมวดหมู่</Label>
                <Select
                  value={form.category_id || "none"}
                  onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกหมวดหมู่" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectOption value="none">ไม่ระบุ</SelectOption>
                    {categories.map((c) => (
                      <SelectOption key={c.id} value={c.id}>
                        {c.name}
                      </SelectOption>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Min Stock with recommendation */}
            <div className="space-y-1.5">
              <Label htmlFor="min-stock">สต็อกขั้นต่ำ</Label>
              <Input
                id="min-stock"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={form.min_stock}
                onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
              />
              {currentRecommendedMinStock && (
                <div className="flex items-center gap-2 rounded-md bg-amber-50 px-2.5 py-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="text-xs text-amber-700">
                    แนะนำ: <strong>{formatNumber(currentRecommendedMinStock.value, 1)}</strong>
                    {" "}(เฉลี่ย {formatNumber(currentRecommendedMinStock.avgDailyUsage, 1)}/วัน x 5 วัน
                    | ข้อมูล {currentRecommendedMinStock.daysOfData} วัน)
                  </span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, min_stock: String(currentRecommendedMinStock.value) })}
                    className="ml-auto text-[10px] font-medium text-amber-600 hover:text-amber-800 whitespace-nowrap"
                  >
                    ใช้ค่านี้
                  </button>
                </div>
              )}
            </div>

            {/* Custom Price with WAC recommendation */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="custom-price">ราคากำหนดเอง</Label>
                <Input
                  id="custom-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={currentRecommendedPrice ? `แนะนำ: ${formatNumber(currentRecommendedPrice, 2)}` : "ไม่ระบุ"}
                  value={form.custom_price}
                  onChange={(e) => setForm({ ...form, custom_price: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price-unit">หน่วยราคา</Label>
                <Input
                  id="price-unit"
                  placeholder="บาท/กก."
                  value={form.custom_price_unit}
                  onChange={(e) => setForm({ ...form, custom_price_unit: e.target.value })}
                />
              </div>
            </div>
            {currentRecommendedPrice != null && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-2.5 py-1.5 -mt-2">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="text-xs text-emerald-700">
                  ราคาแนะนำ (WAC): <strong>{formatNumber(currentRecommendedPrice, 2)}</strong> บาท/หน่วย
                  (คำนวณจากต้นทุนจริงของ lot คงเหลือ)
                </span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, custom_price: String(currentRecommendedPrice) })}
                  className="ml-auto text-[10px] font-medium text-emerald-600 hover:text-emerald-800 whitespace-nowrap"
                >
                  ใช้ค่านี้
                </button>
              </div>
            )}

            {/* Supplier Mappings */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" />
                  ชื่อสินค้าในระบบผู้จัดส่ง
                </Label>
                <button
                  type="button"
                  onClick={addSupplierMapping}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                >
                  <Plus className="h-3 w-3" />
                  เพิ่มผู้จัดส่ง
                </button>
              </div>

              {supplierMappings.length === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  ยังไม่มีผู้จัดส่งที่ผูกกับสินค้านี้ (จะถูกเพิ่มอัตโนมัติเมื่อรับสต็อกเข้า)
                </p>
              ) : (
                <div className="space-y-2">
                  {supplierMappings.map((mapping, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Select
                        value={mapping.supplier_id || "none"}
                        onValueChange={(v) =>
                          updateSupplierMapping(index, "supplier_id", v === "none" ? "" : v)
                        }
                      >
                        <SelectTrigger className="w-[140px] shrink-0">
                          <SelectValue placeholder="เลือกผู้จัดส่ง" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectOption value="none">เลือก...</SelectOption>
                          {getAvailableSuppliers(index).map((s) => (
                            <SelectOption key={s.id} value={s.id}>
                              {s.name}
                            </SelectOption>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="ชื่อสินค้าที่ผู้จัดส่ง"
                        value={mapping.name_at_supplier}
                        onChange={(e) =>
                          updateSupplierMapping(index, "name_at_supplier", e.target.value)
                        }
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeSupplierMapping(index)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-gray-400">
                ชื่อเฉพาะของสินค้าในระบบของแต่ละผู้จัดส่ง ใช้สำหรับแมปข้อมูลจาก OCR ใบเสร็จอัตโนมัติ
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={saving}>
                ยกเลิก
              </Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "กำลังบันทึก..." : editingItem ? "บันทึก" : "เพิ่มสินค้า"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ</DialogTitle>
            <DialogDescription>
              คุณต้องการลบสินค้า{" "}
              <span className="font-semibold text-gray-900">{deletingItem?.name}</span>{" "}
              หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={deleting}>
                ยกเลิก
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "กำลังลบ..." : "ลบสินค้า"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
