"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { useMasterDataStore } from "@/stores/master-data";
import { cn, formatDate } from "@/lib/utils";
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
import { createClient } from "@/lib/supabase/client";
import type { Branch } from "@/types/database";
import {
  Plus,
  Pencil,
  Trash2,
  Building2,
  Crown,
  AlertTriangle,
} from "lucide-react";

interface BranchForm {
  name: string;
  is_hq: boolean;
}

const EMPTY_FORM: BranchForm = {
  name: "",
  is_hq: false,
};

export default function BranchesPage() {
  const { isAdmin } = useAuthStore();
  const { branches, fetchAll, loading: masterLoading } = useMasterDataStore();

  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState<BranchForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const canEdit = isAdmin();

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openCreateDialog = () => {
    setEditingBranch(null);
    setForm(EMPTY_FORM);
    setError("");
    setFormOpen(true);
  };

  const openEditDialog = (branch: Branch) => {
    setEditingBranch(branch);
    setForm({
      name: branch.name,
      is_hq: branch.is_hq,
    });
    setError("");
    setFormOpen(true);
  };

  const openDeleteDialog = (branch: Branch) => {
    setDeletingBranch(branch);
    setDeleteOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("กรุณาระบุชื่อสาขา");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const supabase = createClient();
      const payload = {
        name: form.name.trim(),
        is_hq: form.is_hq,
      };

      if (editingBranch) {
        const { error: err } = await supabase
          .from("branches")
          .update(payload)
          .eq("id", editingBranch.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("branches").insert(payload);
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
    if (!deletingBranch) return;

    setDeleting(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase
        .from("branches")
        .delete()
        .eq("id", deletingBranch.id);
      if (err) throw err;
      setDeleteOpen(false);
      setDeletingBranch(null);
      await fetchAll();
    } catch {
      // silent
    } finally {
      setDeleting(false);
    }
  };

  if (masterLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-28" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
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
          <h1 className="text-xl font-bold text-gray-900">สาขา</h1>
          <p className="text-sm text-gray-500">{branches.length} สาขา</p>
        </div>
        {canEdit && (
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            เพิ่มสาขา
          </Button>
        )}
      </div>

      {/* Branch List */}
      {branches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-16">
          <Building2 className="h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-500">ยังไม่มีสาขา</p>
          <p className="text-xs text-gray-400">เริ่มเพิ่มสาขาแรก</p>
          {canEdit && (
            <Button variant="ghost" size="sm" className="mt-3" onClick={openCreateDialog}>
              <Plus className="mr-1.5 h-4 w-4" />
              เพิ่มสาขา
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="group relative rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  branch.is_hq
                    ? "bg-orange-50 text-orange-500"
                    : "bg-gray-50 text-gray-400"
                )}>
                  <Building2 className="h-5 w-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {branch.name}
                    </h3>
                    {branch.is_hq && (
                      <Badge variant="warning" className="text-[10px] shrink-0 gap-0.5">
                        <Crown className="h-2.5 w-2.5" />
                        สำนักงานใหญ่
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">
                    สร้างเมื่อ {formatDate(branch.created_at)}
                  </p>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditDialog(branch)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => openDeleteDialog(branch)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingBranch ? "แก้ไขสาขา" : "เพิ่มสาขาใหม่"}
            </DialogTitle>
            <DialogDescription>
              {editingBranch
                ? "แก้ไขข้อมูลสาขาด้านล่าง"
                : "กรอกข้อมูลสาขาที่ต้องการเพิ่ม"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Branch Name */}
            <div className="space-y-1.5">
              <Label htmlFor="branch-name">ชื่อสาขา *</Label>
              <Input
                id="branch-name"
                placeholder="เช่น สาขาสยาม"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </div>

            {/* Is HQ */}
            <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={form.is_hq}
                onChange={(e) => setForm({ ...form, is_hq: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">สำนักงานใหญ่</p>
                <p className="text-xs text-gray-400">กำหนดให้สาขานี้เป็นสำนักงานใหญ่</p>
              </div>
            </label>

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
              {saving ? "กำลังบันทึก..." : editingBranch ? "บันทึก" : "เพิ่มสาขา"}
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
              คุณต้องการลบสาขา{" "}
              <span className="font-semibold text-gray-900">{deletingBranch?.name}</span>{" "}
              หรือไม่? ข้อมูลสต็อกและรายการทั้งหมดของสาขานี้จะถูกลบด้วย
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={deleting}>
                ยกเลิก
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "กำลังลบ..." : "ลบสาขา"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
