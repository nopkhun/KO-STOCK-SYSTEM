"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/auth";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, cn } from "@/lib/utils";
import type { Profile, UserRole } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Shield,
  ShieldCheck,
  Eye,
  KeyRound,
  Search,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";

function getRoleBadge(role: UserRole) {
  switch (role) {
    case "master":
      return { label: "Master", variant: "default" as const, icon: ShieldAlert };
    case "admin":
      return { label: "Admin", variant: "warning" as const, icon: ShieldCheck };
    case "viewer":
      return { label: "Viewer", variant: "secondary" as const, icon: Eye };
    default:
      return { label: role, variant: "outline" as const, icon: Shield };
  }
}

export default function UsersPage() {
  const { user: currentUser, isAdmin, isMaster, canManageUsers, loading: authLoading } = useAuthStore();

  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  // Add form state
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [addRole, setAddRole] = useState<UserRole>("viewer");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Edit form state
  const [editRole, setEditRole] = useState<UserRole>("viewer");
  const [editMustChange, setEditMustChange] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete state
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      setUsers((data as Profile[]) || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManageUsers()) {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, [canManageUsers, fetchUsers]);

  // Permission check
  if (authLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!canManageUsers()) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
          <ShieldAlert className="h-10 w-10 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">ไม่มีสิทธิ์เข้าถึง</h1>
        <p className="mt-2 text-sm text-gray-500">
          คุณไม่มีสิทธิ์ในการจัดการผู้ใช้งาน ต้องเป็น Admin หรือ Master เท่านั้น
        </p>
      </div>
    );
  }

  // Which roles can current user assign?
  const assignableRoles: UserRole[] = isMaster()
    ? ["viewer", "admin", "master"]
    : ["viewer"]; // admin can only create viewers

  // Which users can current user manage?
  const canManageUser = (target: Profile) => {
    if (target.id === currentUser?.id) return false;
    if (isMaster()) return true;
    if (isAdmin() && target.role === "viewer") return true;
    return false;
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
  );

  const resetAddForm = () => {
    setAddEmail("");
    setAddPassword("");
    setAddUsername("");
    setAddRole("viewer");
    setAddError("");
  };

  const handleAddUser = async () => {
    if (!addEmail.trim() || !addPassword.trim() || !addUsername.trim()) {
      setAddError("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    if (addPassword.length < 6) {
      setAddError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    try {
      setAddLoading(true);
      setAddError("");
      const supabase = createClient();

      // Sign up the new user via Supabase Auth
      // Note: In production, this would need a server-side function with service_role key
      // For now we use the client-side signup which requires email confirmation to be disabled
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: addEmail.trim(),
        password: addPassword,
        options: {
          data: {
            username: addUsername.trim(),
            role: addRole,
          },
        },
      });

      if (authError) {
        setAddError(authError.message);
        return;
      }

      if (authData.user) {
        // Update the profile that was auto-created by the trigger
        await supabase
          .from("profiles")
          .update({
            username: addUsername.trim(),
            role: addRole,
            must_change_password: true,
          })
          .eq("id", authData.user.id);
      }

      await fetchUsers();
      setAddDialogOpen(false);
      resetAddForm();
    } catch {
      setAddError("เกิดข้อผิดพลาดในการสร้างผู้ใช้");
    } finally {
      setAddLoading(false);
    }
  };

  const openEditDialog = (u: Profile) => {
    setSelectedUser(u);
    setEditRole(u.role);
    setEditMustChange(u.must_change_password);
    setEditError("");
    setEditDialogOpen(true);
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      setEditLoading(true);
      setEditError("");
      const supabase = createClient();

      const { error } = await supabase
        .from("profiles")
        .update({
          role: editRole,
          must_change_password: editMustChange,
        })
        .eq("id", selectedUser.id);

      if (error) {
        setEditError(error.message);
        return;
      }

      await fetchUsers();
      setEditDialogOpen(false);
      setSelectedUser(null);
    } catch {
      setEditError("เกิดข้อผิดพลาดในการแก้ไข");
    } finally {
      setEditLoading(false);
    }
  };

  const openDeleteDialog = (u: Profile) => {
    setSelectedUser(u);
    setDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      setDeleteLoading(true);
      const supabase = createClient();

      // Delete profile (the auth user would need service_role to delete)
      await supabase.from("profiles").delete().eq("id", selectedUser.id);

      await fetchUsers();
      setDeleteDialogOpen(false);
      setSelectedUser(null);
    } catch {
      // silent
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            จัดการผู้ใช้
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            จัดการบัญชีผู้ใช้งานระบบ ({filteredUsers.length} คน)
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) resetAddForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              เพิ่มผู้ใช้
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มผู้ใช้ใหม่</DialogTitle>
              <DialogDescription>
                สร้างบัญชีผู้ใช้งานใหม่ในระบบ
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>อีเมล *</Label>
                <Input
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>รหัสผ่าน *</Label>
                <Input
                  type="password"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                />
              </div>
              <div className="space-y-2">
                <Label>ชื่อผู้ใช้ *</Label>
                <Input
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  placeholder="ชื่อที่แสดงในระบบ"
                />
              </div>
              <div className="space-y-2">
                <Label>ระดับสิทธิ์</Label>
                <Select value={addRole} onValueChange={(v) => setAddRole(v as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableRoles.map((role) => {
                      const rb = getRoleBadge(role);
                      return (
                        <SelectItem key={role} value={role}>
                          <span className="flex items-center gap-2">
                            <rb.icon className="h-3.5 w-3.5" />
                            {rb.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400">
                  {isMaster()
                    ? "Master สามารถกำหนดทุกระดับสิทธิ์"
                    : "Admin สามารถสร้างได้เฉพาะ Viewer"}
                </p>
              </div>

              {addError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {addError}
                </div>
              )}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">ยกเลิก</Button>
              </DialogClose>
              <Button onClick={handleAddUser} disabled={addLoading}>
                {addLoading ? "กำลังสร้าง..." : "สร้างผู้ใช้"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          className="pl-10"
          placeholder="ค้นหาผู้ใช้..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {/* User list */}
      {!loading && filteredUsers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <Users className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-lg font-medium text-gray-700">
              {search ? "ไม่พบผู้ใช้ที่ค้นหา" : "ยังไม่มีผู้ใช้"}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {search
                ? "ลองเปลี่ยนคำค้นหา"
                : "เริ่มต้นเพิ่มผู้ใช้ในระบบ"}
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && filteredUsers.length > 0 && (
        <div className="space-y-2">
          {/* Table header - desktop */}
          <div className="hidden rounded-lg bg-gray-100 px-4 py-2.5 text-xs font-semibold text-gray-500 sm:grid sm:grid-cols-12 sm:gap-4">
            <div className="col-span-4">ผู้ใช้</div>
            <div className="col-span-2">สิทธิ์</div>
            <div className="col-span-2">สถานะ</div>
            <div className="col-span-2">วันที่สร้าง</div>
            <div className="col-span-2 text-right">จัดการ</div>
          </div>

          {filteredUsers.map((u) => {
            const rb = getRoleBadge(u.role);
            const isCurrentUser = u.id === currentUser?.id;
            const manageable = canManageUser(u);

            return (
              <Card key={u.id} className={cn(isCurrentUser && "ring-2 ring-orange-200")}>
                <CardContent className="p-4">
                  {/* Desktop row */}
                  <div className="hidden items-center sm:grid sm:grid-cols-12 sm:gap-4">
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">
                          {u.username}
                          {isCurrentUser && (
                            <span className="ml-1.5 text-xs text-orange-500">(คุณ)</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <Badge variant={rb.variant}>
                        <rb.icon className="mr-1 h-3 w-3" />
                        {rb.label}
                      </Badge>
                    </div>
                    <div className="col-span-2">
                      {u.must_change_password ? (
                        <Badge variant="warning">
                          <KeyRound className="mr-1 h-3 w-3" />
                          ต้องเปลี่ยน
                        </Badge>
                      ) : (
                        <Badge variant="success">ปกติ</Badge>
                      )}
                    </div>
                    <div className="col-span-2 text-sm text-gray-500">
                      {formatDateTime(u.created_at)}
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      {manageable && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(u)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                            onClick={() => openDeleteDialog(u)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Mobile card */}
                  <div className="flex items-start gap-3 sm:hidden">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-gray-900">
                          {u.username}
                        </p>
                        {isCurrentUser && (
                          <span className="text-xs text-orange-500">(คุณ)</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant={rb.variant} className="text-[10px]">
                          <rb.icon className="mr-0.5 h-2.5 w-2.5" />
                          {rb.label}
                        </Badge>
                        {u.must_change_password && (
                          <Badge variant="warning" className="text-[10px]">
                            <KeyRound className="mr-0.5 h-2.5 w-2.5" />
                            ต้องเปลี่ยนรหัส
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        สร้างเมื่อ {formatDateTime(u.created_at)}
                      </p>
                    </div>
                    {manageable && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(u)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                          onClick={() => openDeleteDialog(u)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขผู้ใช้: {selectedUser?.username}</DialogTitle>
            <DialogDescription>
              แก้ไขสิทธิ์และสถานะของผู้ใช้
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ระดับสิทธิ์</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((role) => {
                    const rb = getRoleBadge(role);
                    return (
                      <SelectItem key={role} value={role}>
                        <span className="flex items-center gap-2">
                          <rb.icon className="h-3.5 w-3.5" />
                          {rb.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div>
                <p className="text-sm font-medium text-gray-900">บังคับเปลี่ยนรหัสผ่าน</p>
                <p className="text-xs text-gray-400">
                  ผู้ใช้จะต้องเปลี่ยนรหัสผ่านในการเข้าใช้งานครั้งถัดไป
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={editMustChange}
                onClick={() => setEditMustChange(!editMustChange)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                  editMustChange ? "bg-orange-500" : "bg-gray-200"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform",
                    editMustChange ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {editError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {editError}
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">ยกเลิก</Button>
            </DialogClose>
            <Button onClick={handleEditUser} disabled={editLoading}>
              {editLoading ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">ยืนยันการลบผู้ใช้</DialogTitle>
            <DialogDescription>
              คุณต้องการลบผู้ใช้ <strong>{selectedUser?.username}</strong> ออกจากระบบหรือไม่?
              การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
            <div className="text-sm text-red-700">
              <p className="font-medium">ข้อมูลที่จะถูกลบ:</p>
              <ul className="mt-1 list-inside list-disc text-xs">
                <li>บัญชีผู้ใช้ &quot;{selectedUser?.username}&quot;</li>
                <li>สิทธิ์การเข้าถึงทั้งหมด</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">ยกเลิก</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={deleteLoading}
            >
              {deleteLoading ? "กำลังลบ..." : "ลบผู้ใช้"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
