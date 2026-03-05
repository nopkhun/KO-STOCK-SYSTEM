"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { useMasterDataStore } from "@/stores/master-data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Package,
  PackagePlus,
  PackageMinus,
  ArrowRightLeft,
  ClipboardCheck,
  History,
  BarChart3,
  BoxSelect,
  Building2,
  Ruler,
  Tags,
  Truck,
  Calculator,
  Users,
  FileText,
  Menu,
  X,
  LogOut,
  ChevronDown,
  User,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
}

const mainNav: NavItem[] = [
  { label: "แดชบอร์ด", href: "/", icon: LayoutDashboard },
  { label: "สต็อกสินค้า", href: "/inventory", icon: Package },
  { label: "นำเข้าสินค้า", href: "/stock-in", icon: PackagePlus },
  { label: "เบิกของ", href: "/stock-out", icon: PackageMinus },
  { label: "โอนย้าย", href: "/transfer", icon: ArrowRightLeft },
  { label: "ตรวจนับสต็อก", href: "/stocktake", icon: ClipboardCheck },
  { label: "ประวัติ", href: "/history", icon: History },
  { label: "รายงาน", href: "/reports", icon: BarChart3 },
];

const masterNav: NavItem[] = [
  { label: "รายการสินค้า", href: "/items", icon: BoxSelect },
  { label: "สาขา", href: "/branches", icon: Building2 },
  { label: "หน่วย", href: "/units", icon: Ruler },
  { label: "หมวดหมู่", href: "/categories", icon: Tags },
  { label: "ผู้จัดส่ง", href: "/suppliers", icon: Truck },
];

const toolNav: NavItem[] = [
  { label: "คำนวณต้นทุน", href: "/cost-calculator", icon: Calculator },
  { label: "รายงานมูลค่า", href: "/value-report", icon: FileText },
  { label: "จัดการผู้ใช้", href: "/users", icon: Users, roles: ["admin", "master"] },
];

const mobileNav: NavItem[] = [
  { label: "แดชบอร์ด", href: "/", icon: LayoutDashboard },
  { label: "สต็อก", href: "/inventory", icon: Package },
  { label: "ตรวจนับ", href: "/stocktake", icon: ClipboardCheck },
  { label: "ประวัติ", href: "/history", icon: History },
  { label: "เพิ่มเติม", href: "#more", icon: Menu },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, loading: authLoading } = useAuthStore();
  const { branches, selectedBranchId, setSelectedBranchId } = useMasterDataStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  // Close menus on outside click
  useEffect(() => {
    const handleClick = () => setUserMenuOpen(false);
    if (userMenuOpen) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [userMenuOpen]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const canAccess = (item: NavItem) => {
    if (!item.roles) return true;
    return user?.role && item.roles.includes(user.role);
  };

  // Redirect to login if not authenticated (auth guard)
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
          <p className="text-sm text-gray-500">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // Don't render dashboard until user is confirmed
  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white border-r border-gray-200 transition-transform duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar header */}
        <div className="flex h-16 items-center justify-between border-b border-gray-100 px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">FoodStock</h1>
              <p className="text-[10px] text-gray-400">Manager</p>
            </div>
          </Link>
          <button
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Branch selector */}
        <div className="border-b border-gray-100 p-3">
          <select
            value={selectedBranchId || ""}
            onChange={(e) => setSelectedBranchId(e.target.value || null)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
          >
            <option value="">ทุกสาขา</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} {b.is_hq ? "(สำนักงานใหญ่)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-6">
          {/* Main */}
          <div>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              หลัก
            </p>
            <ul className="space-y-0.5">
              {mainNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive(item.href)
                        ? "bg-orange-50 text-orange-600"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4", isActive(item.href) ? "text-orange-500" : "text-gray-400")} />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Master data */}
          <div>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              ข้อมูลหลัก
            </p>
            <ul className="space-y-0.5">
              {masterNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive(item.href)
                        ? "bg-orange-50 text-orange-600"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4", isActive(item.href) ? "text-orange-500" : "text-gray-400")} />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Tools */}
          <div>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              เครื่องมือ
            </p>
            <ul className="space-y-0.5">
              {toolNav.filter(canAccess).map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive(item.href)
                        ? "bg-orange-50 text-orange-600"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4", isActive(item.href) ? "text-orange-500" : "text-gray-400")} />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* User section at bottom */}
        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{user?.username || "-"}</p>
              <p className="text-[10px] text-gray-400 capitalize">{user?.role || "-"}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              title="ออกจากระบบ"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/80 px-4 backdrop-blur-md lg:px-6">
          <button
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Branch selector (mobile) */}
          <div className="flex-1 lg:hidden">
            <select
              value={selectedBranchId || ""}
              onChange={(e) => setSelectedBranchId(e.target.value || null)}
              className="w-full rounded-lg border-0 bg-transparent py-1 text-sm font-medium text-gray-700 focus:outline-none"
            >
              <option value="">ทุกสาขา</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Spacer for desktop */}
          <div className="hidden flex-1 lg:block" />

          {/* User menu (desktop) */}
          <div className="relative hidden lg:block">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setUserMenuOpen(!userMenuOpen);
              }}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                <User className="h-3.5 w-3.5" />
              </div>
              <span className="font-medium">{user?.username}</span>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                <div className="border-b border-gray-100 px-3 py-2">
                  <p className="text-sm font-medium text-gray-900">{user?.username}</p>
                  <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
                </div>
                <button
                  onClick={() => {
                    router.push("/change-password");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  เปลี่ยนรหัสผ่าน
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  ออกจากระบบ
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 pb-20 lg:p-6 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white lg:hidden">
        <div className="flex items-center justify-around">
          {mobileNav.map((item) => {
            if (item.href === "#more") {
              return (
                <button
                  key="more"
                  onClick={() => setMoreOpen(!moreOpen)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                    moreOpen ? "text-orange-500" : "text-gray-400"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                  isActive(item.href)
                    ? "text-orange-500"
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive(item.href) && "text-orange-500")} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* "More" sheet */}
        {moreOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
            <div className="fixed bottom-14 left-0 right-0 z-50 rounded-t-2xl border-t border-gray-200 bg-white p-4 shadow-2xl">
              <div className="mx-auto mb-3 h-1 w-8 rounded-full bg-gray-200" />
              <div className="grid grid-cols-4 gap-3">
                {[...mainNav.slice(3), ...masterNav, ...toolNav].filter(canAccess).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl p-3 text-center transition-colors",
                      isActive(item.href)
                        ? "bg-orange-50 text-orange-600"
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </nav>
    </div>
  );
}
