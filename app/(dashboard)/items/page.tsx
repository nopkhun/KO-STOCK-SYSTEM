"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuthStore } from "@/stores/auth";
import { useMasterDataStore } from "@/stores/master-data";
import { cn, formatNumber, formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogTrigger,
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
  SelectItem,
} from "@/components/ui/select";
import type { ItemWithRelations } from "@/types/database";
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
} from "lucide-react";

interface ItemForm {
  name: string;
  unit_id: string;
  category_id: string;
  min_stock: string;
  custom_price: string;
  custom_price_unit: string;
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
  const { items, units, categories, fetchAll, loading: masterLoading } = useMasterDataStore();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemWithRelations | null>(null);
  const [deletingItem, setDeletingItem] = useState<ItemWithRelations | null>(null);
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const canEdit = isAdmin();

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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
    setError("");
    setFormOpen(true);
  };

  const openDeleteDialog = (item: ItemWithRelations) => {
    setDeletingItem(item);
    setDeleteOpen(true);
  };

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

      if (editingItem) {
        const { error: err } = await supabase
          .from("items")
          .update(payload)
          .eq("id", editingItem.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("items").insert(payload);
        if (err) throw err;
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
            <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
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
                  <th className="px-4 py-3 text-right font-medium text-gray-500">สต็อกขั้นต่ำ</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">ราคากำหนดเอง</th>
                  {canEdit && (
                    <th className="px-4 py-3 text-right font-medium text-gray-500 w-24">จัดการ</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((item) => (
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
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-600">
                      {formatNumber(item.min_stock, 2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {item.custom_price != null ? (
                        <span>
                          {formatNumber(item.custom_price, 2)}{" "}
                          <span className="text-xs text-gray-400">{item.custom_price_unit}</span>
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
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
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-2 lg:hidden">
            {filtered.map((item) => (
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
                      <span>ขั้นต่ำ: {formatNumber(item.min_stock, 2)}</span>
                      {item.custom_price != null && (
                        <span>ราคา: {formatNumber(item.custom_price, 2)} {item.custom_price_unit}</span>
                      )}
                    </div>
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
            ))}
          </div>
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
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
                    <SelectItem value="none">ไม่ระบุ</SelectItem>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
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
                    <SelectItem value="none">ไม่ระบุ</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Min Stock */}
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
            </div>

            {/* Custom Price */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="custom-price">ราคากำหนดเอง</Label>
                <Input
                  id="custom-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="ไม่ระบุ"
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
