"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useMasterDataStore } from "@/stores/master-data";
import { useInventoryStore } from "@/stores/inventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatNumber, formatCurrency } from "@/lib/utils";
import { calculateTotalStock } from "@/lib/utils/fifo";
import {
  Search,
  ClipboardCheck,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Save,
  RotateCcw,
  Filter,
  Package,
  ArrowUpDown,
} from "lucide-react";
import type { InventoryLot, ItemWithRelations } from "@/types/database";

interface StocktakeItem {
  item: ItemWithRelations;
  systemQty: number;
  countedQty: string; // string for input binding
  isCounted: boolean;
  discrepancy: number;
}

export default function StocktakePage() {
  const {
    items,
    categories,
    branches,
    selectedBranchId,
    setSelectedBranchId,
    loading: masterLoading,
    fetchAll,
    getBranchById,
  } = useMasterDataStore();
  const {
    lots,
    loading: invLoading,
    fetchInventory,
  } = useInventoryStore();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stocktakeData, setStocktakeData] = useState<Map<string, string>>(
    new Map()
  );
  const [showOnlyDiscrepancies, setShowOnlyDiscrepancies] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (selectedBranchId) {
      fetchInventory(selectedBranchId);
    }
  }, [selectedBranchId, fetchInventory]);

  const loading = masterLoading || invLoading;

  // Build stocktake rows
  const stocktakeItems = useMemo<StocktakeItem[]>(() => {
    return items.map((item) => {
      const itemLots = lots.filter(
        (l) =>
          l.item_id === item.id &&
          l.remaining_qty > 0 &&
          (!selectedBranchId || l.branch_id === selectedBranchId)
      );
      const systemQty = calculateTotalStock(itemLots);
      const countedQtyStr = stocktakeData.get(item.id) ?? "";
      const countedQty = countedQtyStr === "" ? NaN : parseFloat(countedQtyStr);
      const isCounted = countedQtyStr !== "" && !isNaN(countedQty);
      const discrepancy = isCounted ? countedQty - systemQty : 0;

      return {
        item,
        systemQty,
        countedQty: countedQtyStr,
        isCounted,
        discrepancy,
      };
    });
  }, [items, lots, stocktakeData, selectedBranchId]);

  // Apply filters
  const filteredItems = useMemo(() => {
    let result = stocktakeItems;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((r) => r.item.name.toLowerCase().includes(q));
    }

    if (categoryFilter !== "all") {
      result = result.filter((r) => r.item.category_id === categoryFilter);
    }

    if (showOnlyDiscrepancies) {
      result = result.filter((r) => r.isCounted && r.discrepancy !== 0);
    }

    return result;
  }, [stocktakeItems, search, categoryFilter, showOnlyDiscrepancies]);

  // Summary stats
  const summary = useMemo(() => {
    const counted = stocktakeItems.filter((r) => r.isCounted).length;
    const withDiscrepancy = stocktakeItems.filter(
      (r) => r.isCounted && r.discrepancy !== 0
    ).length;
    const totalItems = stocktakeItems.length;
    return { counted, withDiscrepancy, totalItems };
  }, [stocktakeItems]);

  const handleCountChange = useCallback(
    (itemId: string, value: string) => {
      setStocktakeData((prev) => {
        const next = new Map(prev);
        if (value === "") {
          next.delete(itemId);
        } else {
          next.set(itemId, value);
        }
        return next;
      });
    },
    []
  );

  const handleReset = useCallback(() => {
    setStocktakeData(new Map());
    setSavedMessage(false);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    // Simulate saving - in production this would call adjust transactions
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 3000);
  }, []);

  // No branch selected
  if (!selectedBranchId && !masterLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 lg:text-2xl">
            ตรวจนับสต็อก
          </h1>
          <p className="text-sm text-gray-500">
            เลือกสาขาเพื่อเริ่มต้นตรวจนับสต็อกจริง
          </p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 mb-4">
            <Building2 className="h-8 w-8 text-orange-400" />
          </div>
          <p className="text-base font-medium text-gray-700 mb-2">
            กรุณาเลือกสาขา
          </p>
          <p className="text-sm text-gray-400 mb-6 max-w-xs text-center">
            เลือกสาขาจากเมนูด้านซ้ายหรือเลือกจากรายการด้านล่าง
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {branches.map((branch) => (
              <Button
                key={branch.id}
                variant="outline"
                onClick={() => setSelectedBranchId(branch.id)}
                className="gap-2"
              >
                <Building2 className="h-4 w-4" />
                {branch.name}
                {branch.is_hq && (
                  <Badge variant="secondary" className="text-[10px] ml-1">
                    HQ
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loading && items.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-1" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-10 rounded-lg" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const branchName = selectedBranchId
    ? getBranchById(selectedBranchId)?.name
    : "";

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 lg:text-2xl">
            ตรวจนับสต็อก
          </h1>
          <p className="text-sm text-gray-500">
            ตรวจนับสต็อกจริง — {branchName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={stocktakeData.size === 0}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            <span className="hidden sm:inline">รีเซ็ต</span>
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={summary.counted === 0 || isSaving}
          >
            {isSaving ? (
              <div className="mr-1.5 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            บันทึกผลตรวจนับ
          </Button>
        </div>
      </div>

      {/* Saved message */}
      {savedMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <p className="text-sm text-green-700">
            บันทึกผลตรวจนับเรียบร้อยแล้ว
          </p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 lg:p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 flex-shrink-0">
                <ClipboardCheck className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 lg:text-xl">
                  {summary.counted}
                  <span className="text-sm font-normal text-gray-400">
                    /{summary.totalItems}
                  </span>
                </p>
                <p className="text-[11px] text-gray-500">นับแล้ว</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 lg:p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 flex-shrink-0">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 lg:text-xl">
                  {summary.withDiscrepancy}
                </p>
                <p className="text-[11px] text-gray-500">ยอดไม่ตรง</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 lg:p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 flex-shrink-0">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 lg:text-xl">
                  {summary.counted > 0
                    ? Math.round(
                        ((summary.counted - summary.withDiscrepancy) /
                          summary.counted) *
                          100
                      )
                    : 0}
                  %
                </p>
                <p className="text-[11px] text-gray-500">ถูกต้อง</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="ค้นหาสินค้า..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="mr-2 h-4 w-4 text-gray-400" />
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
        <Button
          variant={showOnlyDiscrepancies ? "default" : "outline"}
          size="sm"
          onClick={() => setShowOnlyDiscrepancies((v) => !v)}
          className="h-10 whitespace-nowrap"
        >
          <ArrowUpDown className="mr-1.5 h-4 w-4" />
          เฉพาะยอดไม่ตรง
        </Button>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block">
        {filteredItems.length === 0 ? (
          <EmptyStocktake
            search={search}
            showOnlyDiscrepancies={showOnlyDiscrepancies}
          />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    สินค้า
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    หมวดหมู่
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    หน่วย
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">
                    ยอดระบบ
                  </th>
                  <th className="w-40 px-4 py-3 text-right font-medium text-gray-500">
                    นับจริง
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">
                    ผลต่าง
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">
                    สถานะ
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((row) => (
                  <tr
                    key={row.item.id}
                    className={cn(
                      "border-b border-gray-50 transition-colors",
                      row.isCounted && row.discrepancy !== 0
                        ? "bg-amber-50/40"
                        : row.isCounted && row.discrepancy === 0
                          ? "bg-green-50/30"
                          : "hover:bg-gray-50/50"
                    )}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {row.item.name}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {row.item.category?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {row.item.unit?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {formatNumber(row.systemQty, 2)}
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="—"
                        value={row.countedQty}
                        onChange={(e) =>
                          handleCountChange(row.item.id, e.target.value)
                        }
                        className={cn(
                          "h-8 text-right font-mono",
                          row.isCounted && row.discrepancy !== 0
                            ? "border-amber-300 focus:ring-amber-500"
                            : row.isCounted && row.discrepancy === 0
                              ? "border-green-300 focus:ring-green-500"
                              : ""
                        )}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.isCounted ? (
                        <span
                          className={cn(
                            "font-mono font-semibold",
                            row.discrepancy > 0
                              ? "text-green-600"
                              : row.discrepancy < 0
                                ? "text-red-600"
                                : "text-gray-400"
                          )}
                        >
                          {row.discrepancy > 0 ? "+" : ""}
                          {formatNumber(row.discrepancy, 2)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!row.isCounted ? (
                        <Badge variant="outline" className="text-[10px]">
                          รอนับ
                        </Badge>
                      ) : row.discrepancy === 0 ? (
                        <Badge variant="success" className="text-[10px]">
                          ตรง
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="text-[10px]">
                          ไม่ตรง
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 lg:hidden">
        {filteredItems.length === 0 ? (
          <EmptyStocktake
            search={search}
            showOnlyDiscrepancies={showOnlyDiscrepancies}
          />
        ) : (
          filteredItems.map((row) => (
            <Card
              key={row.item.id}
              className={cn(
                "overflow-hidden",
                row.isCounted && row.discrepancy !== 0
                  ? "border-amber-200 bg-amber-50/30"
                  : row.isCounted && row.discrepancy === 0
                    ? "border-green-200 bg-green-50/20"
                    : ""
              )}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 truncate text-sm">
                        {row.item.name}
                      </p>
                      {!row.isCounted ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] flex-shrink-0"
                        >
                          รอนับ
                        </Badge>
                      ) : row.discrepancy === 0 ? (
                        <Badge
                          variant="success"
                          className="text-[10px] flex-shrink-0"
                        >
                          ตรง
                        </Badge>
                      ) : (
                        <Badge
                          variant="warning"
                          className="text-[10px] flex-shrink-0"
                        >
                          ไม่ตรง
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {row.item.category?.name || "—"} ·{" "}
                      {row.item.unit?.name || "—"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-[10px] text-gray-400 mb-0.5">
                      ยอดระบบ
                    </p>
                    <p className="text-sm font-mono font-semibold text-gray-700">
                      {formatNumber(row.systemQty, 2)}
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-gray-400 mb-0.5">
                      นับจริง
                    </p>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="—"
                      value={row.countedQty}
                      onChange={(e) =>
                        handleCountChange(row.item.id, e.target.value)
                      }
                      className={cn(
                        "h-8 text-sm font-mono",
                        row.isCounted && row.discrepancy !== 0
                          ? "border-amber-300"
                          : row.isCounted && row.discrepancy === 0
                            ? "border-green-300"
                            : ""
                      )}
                    />
                  </div>
                  <div className="w-16 text-right">
                    <p className="text-[10px] text-gray-400 mb-0.5">
                      ผลต่าง
                    </p>
                    {row.isCounted ? (
                      <p
                        className={cn(
                          "text-sm font-mono font-semibold",
                          row.discrepancy > 0
                            ? "text-green-600"
                            : row.discrepancy < 0
                              ? "text-red-600"
                              : "text-gray-400"
                        )}
                      >
                        {row.discrepancy > 0 ? "+" : ""}
                        {formatNumber(row.discrepancy, 2)}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-300">—</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Progress bar at bottom */}
      {summary.totalItems > 0 && (
        <div className="sticky bottom-16 lg:bottom-0 bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200 p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">
              ความคืบหน้า:{" "}
              <span className="font-semibold text-gray-700">
                {summary.counted}/{summary.totalItems}
              </span>{" "}
              รายการ
            </span>
            <span className="text-xs text-gray-500">
              {summary.totalItems > 0
                ? Math.round((summary.counted / summary.totalItems) * 100)
                : 0}
              %
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                summary.counted === summary.totalItems && summary.totalItems > 0
                  ? "bg-green-500"
                  : "bg-orange-500"
              )}
              style={{
                width: `${
                  summary.totalItems > 0
                    ? (summary.counted / summary.totalItems) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyStocktake({
  search,
  showOnlyDiscrepancies,
}: {
  search: string;
  showOnlyDiscrepancies: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-50 mb-4">
        <Package className="h-7 w-7 text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-700">
        {showOnlyDiscrepancies
          ? "ไม่มีรายการที่ยอดไม่ตรง"
          : search
            ? "ไม่พบสินค้าที่ค้นหา"
            : "ยังไม่มีข้อมูลสินค้า"}
      </p>
      <p className="text-xs text-gray-400 mt-1">
        {showOnlyDiscrepancies
          ? "ยอดนับจริงตรงกับยอดระบบทุกรายการ หรือยังไม่ได้กรอกยอดนับ"
          : search
            ? `ไม่พบสินค้าที่ตรงกับ "${search}"`
            : "เพิ่มรายการสินค้าในระบบก่อนเริ่มตรวจนับ"}
      </p>
    </div>
  );
}
