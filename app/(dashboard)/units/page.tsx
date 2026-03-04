"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { useMasterDataStore } from "@/stores/master-data";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import type { Unit } from "@/types/database";
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
import { Plus, Pencil, Trash2, Search, Ruler } from "lucide-react";

export default function UnitsPage() {
  const { isAdmin } = useAuthStore();
  const { units, loading, fetchAll } = useMasterDataStore();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filtered = units.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  const canEdit = isAdmin();

  function openAdd() {
    setEditingUnit(null);
    setName("");
    setError("");
    setDialogOpen(true);
  }

  function openEdit(unit: Unit) {
    setEditingUnit(unit);
    setName(unit.name);
    setError("");
    setDialogOpen(true);
  }

  function openDelete(unit: Unit) {
    setDeletingUnit(unit);
    setDeleteDialogOpen(true);
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("กรุณากรอกชื่อหน่วย");
      return;
    }

    setSaving(true);
    setError("");
    const supabase = createClient();

    if (editingUnit) {
      const { error: err } = await supabase
        .from("units")
        .update({ name: trimmed })
        .eq("id", editingUnit.id);
      if (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: err } = await supabase
        .from("units")
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
    if (!deletingUnit) return;
    setSaving(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("units")
      .delete()
      .eq("id", deletingUnit.id);

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setDeleteDialogOpen(false);
    setDeletingUnit(null);
    await fetchAll();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">หน่วย</h1>
          <p className="text-sm text-gray-500">จัดการหน่วยนับสินค้า</p>
        </div>
        {canEdit && (
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            เพิ่มหน่วย
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="ค้นหาหน่วย..."
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
              <Ruler className="mb-3 h-10 w-10" />
              <p className="text-sm">
                {search ? "ไม่พบหน่วยที่ค้นหา" : "ยังไม่มีข้อมูลหน่วย"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-500">
                    <th className="pb-3 font-medium">ชื่อหน่วย</th>
                    <th className="pb-3 font-medium">วันที่สร้าง</th>
                    {canEdit && (
                      <th className="pb-3 text-right font-medium">จัดการ</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((unit) => (
                    <tr key={unit.id} className="hover:bg-gray-50/50">
                      <td className="py-3 font-medium text-gray-900">
                        {unit.name}
                      </td>
                      <td className="py-3 text-gray-500">
                        {formatDate(unit.created_at)}
                      </td>
                      {canEdit && (
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(unit)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDelete(unit)}
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
              {editingUnit ? "แก้ไขหน่วย" : "เพิ่มหน่วย"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="unit-name">ชื่อหน่วย</Label>
              <Input
                id="unit-name"
                placeholder="เช่น กก., ลิตร, ชิ้น"
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
            ต้องการลบหน่วย{" "}
            <span className="font-semibold text-gray-900">
              &quot;{deletingUnit?.name}&quot;
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
