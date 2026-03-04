"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { useMasterDataStore } from "@/stores/master-data";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import type { Category } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Tags } from "lucide-react";

export default function CategoriesPage() {
  const { isAdmin } = useAuthStore();
  const { categories, loading, fetchAll } = useMasterDataStore();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(
    null
  );
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const canEdit = isAdmin();

  function openAdd() {
    setEditingCategory(null);
    setName("");
    setError("");
    setDialogOpen(true);
  }

  function openEdit(category: Category) {
    setEditingCategory(category);
    setName(category.name);
    setError("");
    setDialogOpen(true);
  }

  function openDelete(category: Category) {
    setDeletingCategory(category);
    setDeleteDialogOpen(true);
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("กรุณากรอกชื่อหมวดหมู่");
      return;
    }

    setSaving(true);
    setError("");
    const supabase = createClient();

    if (editingCategory) {
      const { error: err } = await supabase
        .from("categories")
        .update({ name: trimmed })
        .eq("id", editingCategory.id);
      if (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: err } = await supabase
        .from("categories")
        .insert({ name: trimmed });
      if (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setDialogOpen(false);
    await fetchAll();
  }

  async function handleDelete() {
    if (!deletingCategory) return;
    setSaving(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("categories")
      .delete()
      .eq("id", deletingCategory.id);

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setDeleteDialogOpen(false);
    setDeletingCategory(null);
    await fetchAll();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">หมวดหมู่</h1>
          <p className="text-sm text-gray-500">จัดการหมวดหมู่สินค้า</p>
        </div>
        {canEdit && (
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            เพิ่มหมวดหมู่
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="ค้นหาหมวดหมู่..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <span className="text-sm text-gray-500">
              {filtered.length} รายการ
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Tags className="mb-3 h-10 w-10" />
              <p className="text-sm">
                {search
                  ? "ไม่พบหมวดหมู่ที่ค้นหา"
                  : "ยังไม่มีข้อมูลหมวดหมู่"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-500">
                    <th className="pb-3 font-medium">ชื่อหมวดหมู่</th>
                    <th className="pb-3 font-medium">วันที่สร้าง</th>
                    {canEdit && (
                      <th className="pb-3 text-right font-medium">จัดการ</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((category) => (
                    <tr key={category.id} className="hover:bg-gray-50/50">
                      <td className="py-3 font-medium text-gray-900">
                        {category.name}
                      </td>
                      <td className="py-3 text-gray-500">
                        {formatDate(category.created_at)}
                      </td>
                      {canEdit && (
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(category)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDelete(category)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="category-name">ชื่อหมวดหมู่</Label>
              <Input
                id="category-name"
                placeholder="เช่น เนื้อสัตว์, ผัก, เครื่องปรุง"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">ยกเลิก</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            ต้องการลบหมวดหมู่{" "}
            <span className="font-semibold text-gray-900">
              &quot;{deletingCategory?.name}&quot;
            </span>{" "}
            ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
          </p>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">ยกเลิก</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
            >
              {saving ? "กำลังลบ..." : "ลบ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
