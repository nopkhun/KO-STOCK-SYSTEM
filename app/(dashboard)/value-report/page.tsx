"use client";

import { useState, useEffect, useMemo } from "react";
import { useMasterDataStore } from "@/stores/master-data";
import { useInventoryStore } from "@/stores/inventory";
import { calculateWAC, calculateTotalStock, calculateTotalValue } from "@/lib/utils/fifo";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  FileText,
  Printer,
  Download,
  Package,
  DollarSign,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Layers,
  Info,
} from "lucide-react";

interface StockRow {
  itemId: string;
  itemName: string;
  categoryId: string;
  categoryName: string;
  unitName: string;
  totalQty: number;
  wac: number;
  totalValue: number;
}

export default function ValueReportPage() {
  const {
    branches,
    items,
    categories,
    loading: masterLoading,
    fetchAll,
  } = useMasterDataStore();
  const { lots, loading: invLoading, fetchInventory } = useInventoryStore();

  const [branchId, setBranchId] = useState<string>("all");
  const [sortField, setSortField] = useState<"value" | "name" | "qty">("value");
  const [sortAsc, setSortAsc] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAll();
    fetchInventory();
  }, [fetchAll, fetchInventory]);

  // Refetch when branch changes
  useEffect(() => {
    if (branchId === "all") {
      fetchInventory();
    } else {
      fetchInventory(branchId);
    }
  }, [branchId, fetchInventory]);

  // Build stock rows
  const stockRows: StockRow[] = useMemo(() => {
    const rows: StockRow[] = [];

    for (const item of items) {
      const itemLots = lots.filter(
        (l) =>
          l.item_id === item.id &&
          l.remaining_qty > 0 &&
          (branchId === "all" || l.branch_id === branchId)
      );

      if (itemLots.length === 0) continue;

      const totalQty = calculateTotalStock(itemLots);
      const wac = calculateWAC(itemLots);
      const totalValue = calculateTotalValue(itemLots);

      rows.push({
        itemId: item.id,
        itemName: item.name,
        categoryId: item.category_id || "uncategorized",
        categoryName: item.category?.name || "ไม่ระบุหมวดหมู่",
        unitName: item.unit?.name || "-",
        totalQty,
        wac,
        totalValue,
      });
    }

    return rows;
  }, [items, lots, branchId]);

  // Sort
  const sortedRows = useMemo(() => {
    const sorted = [...stockRows].sort((a, b) => {
      let cmp = 0;
      if (sortField === "value") cmp = a.totalValue - b.totalValue;
      else if (sortField === "name") cmp = a.itemName.localeCompare(b.itemName, "th");
      else if (sortField === "qty") cmp = a.totalQty - b.totalQty;
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [stockRows, sortField, sortAsc]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, { categoryName: string; rows: StockRow[]; subtotal: number }>();

    for (const row of sortedRows) {
      const existing = map.get(row.categoryId);
      if (existing) {
        existing.rows.push(row);
        existing.subtotal += row.totalValue;
      } else {
        map.set(row.categoryId, {
          categoryName: row.categoryName,
          rows: [row],
          subtotal: row.totalValue,
        });
      }
    }

    // Sort groups by subtotal descending
    return Array.from(map.entries()).sort((a, b) => b[1].subtotal - a[1].subtotal);
  }, [sortedRows]);

  // Grand total
  const grandTotal = useMemo(
    () => stockRows.reduce((sum, r) => sum + r.totalValue, 0),
    [stockRows]
  );
  const totalItems = stockRows.length;
  const totalCategories = grouped.length;

  const toggleCategory = (catId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  const handleSort = (field: "value" | "name" | "qty") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const isLoading = masterLoading || invLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            รายงานมูลค่าสต็อก
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            มูลค่าสินค้าคงเหลือตามต้นทุนจริงจากใบเสร็จ (Weighted Average Cost)
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            พิมพ์
          </Button>
          <Button
            variant="outline"
            onClick={() => alert("ฟีเจอร์ส่งออกข้อมูลจะเปิดให้ใช้เร็วๆ นี้")}
          >
            <Download className="mr-2 h-4 w-4" />
            ส่งออก
          </Button>
        </div>
      </div>

      {/* Branch filter */}
      <div className="flex items-center gap-3 print:hidden">
        <Label className="shrink-0 text-sm font-medium">สาขา:</Label>
        <Select value={branchId} onValueChange={setBranchId}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="เลือกสาขา" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสาขา</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name} {b.is_hq ? "(สำนักงานใหญ่)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Calculation methodology info */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 print:hidden">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        <div className="text-xs leading-relaxed text-blue-700">
          <span className="font-medium">วิธีคำนวณ:</span>{" "}
          มูลค่าสต็อกคำนวณจาก<strong>ต้นทุนจริงในแต่ละ Lot</strong> (ราคาที่ซื้อมาจริงตามใบเสร็จ)
          โดยใช้วิธี <strong>WAC (Weighted Average Cost)</strong> — ไม่ใช่ราคาขาย
          เมื่อนำเข้าสินค้าใหม่ ราคาต้นทุนเฉลี่ยจะอัปเดตอัตโนมัติ
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block">
        <h2 className="text-lg font-bold">รายงานมูลค่าสต็อก (ต้นทุนจริง WAC)</h2>
        <p className="text-sm text-gray-500">
          สาขา: {branchId === "all" ? "ทุกสาขา" : branches.find((b) => b.id === branchId)?.name}
          {" | "}วันที่พิมพ์: {new Date().toLocaleDateString("th-TH")}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          * มูลค่าคำนวณจากต้นทุนซื้อจริงตามใบเสร็จ (Weighted Average Cost) ไม่ใช่ราคาขาย
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">มูลค่ารวม (ต้นทุนจริง)</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(grandTotal)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">สินค้าที่มีสต็อก</p>
              <p className="text-2xl font-bold text-gray-900">{totalItems} รายการ</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-100">
              <Layers className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">หมวดหมู่</p>
              <p className="text-2xl font-bold text-gray-900">{totalCategories} หมวด</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock table */}
      {stockRows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-lg font-medium text-gray-700">ไม่มีข้อมูลสต็อก</p>
            <p className="mt-1 text-sm text-gray-400">
              ยังไม่มีสินค้าคงเหลือในสาขาที่เลือก
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                    <th className="whitespace-nowrap px-4 py-3">
                      <button
                        className="flex items-center gap-1 hover:text-gray-700 print:pointer-events-none"
                        onClick={() => handleSort("name")}
                      >
                        สินค้า
                        {sortField === "name" && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </th>
                    <th className="whitespace-nowrap px-4 py-3">หน่วย</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        className="ml-auto flex items-center gap-1 hover:text-gray-700 print:pointer-events-none"
                        onClick={() => handleSort("qty")}
                      >
                        จำนวน
                        {sortField === "qty" && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex flex-col items-end">
                        <span>ต้นทุนเฉลี่ย</span>
                        <span className="text-[10px] font-normal text-gray-400">(WAC/หน่วย)</span>
                      </div>
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        className="ml-auto flex items-center gap-1 hover:text-gray-700 print:pointer-events-none"
                        onClick={() => handleSort("value")}
                      >
                        มูลค่ารวม
                        {sortField === "value" && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </th>
                  </tr>
                </thead>
                {grouped.map(([catId, group]) => {
                  const isCollapsed = collapsedCategories.has(catId);
                  const pctOfTotal = grandTotal > 0
                    ? (group.subtotal / grandTotal) * 100
                    : 0;

                  return (
                    <tbody key={catId}>
                      {/* Category header */}
                      <tr
                        className="cursor-pointer border-b border-gray-200 bg-gray-100/70 transition-colors hover:bg-gray-100 print:cursor-default"
                        onClick={() => toggleCategory(catId)}
                      >
                        <td colSpan={4} className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="print:hidden">
                              {isCollapsed ? (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronUp className="h-4 w-4 text-gray-400" />
                              )}
                            </span>
                            <span className="font-semibold text-gray-800">
                              {group.categoryName}
                            </span>
                            <Badge variant="secondary" className="text-[10px]">
                              {group.rows.length} รายการ
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {formatNumber(pctOfTotal, 1)}%
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-gray-800">
                          {formatCurrency(group.subtotal)}
                        </td>
                      </tr>

                      {/* Items in category */}
                      {!isCollapsed &&
                        group.rows.map((row) => {
                          const rowPct = grandTotal > 0
                            ? (row.totalValue / grandTotal) * 100
                            : 0;

                          return (
                            <tr
                              key={row.itemId}
                              className="border-b border-gray-50 transition-colors hover:bg-gray-50"
                            >
                              <td className="whitespace-nowrap px-4 py-2.5 pl-10 font-medium text-gray-900">
                                {row.itemName}
                              </td>
                              <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">
                                {row.unitName}
                              </td>
                              <td className="whitespace-nowrap px-4 py-2.5 text-right text-gray-700">
                                {formatNumber(row.totalQty, 2)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-2.5 text-right text-gray-600">
                                {formatNumber(row.wac, 2)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <span className="font-medium text-gray-900">
                                    {formatCurrency(row.totalValue)}
                                  </span>
                                  {rowPct >= 5 && (
                                    <span className="text-[10px] text-gray-400">
                                      ({formatNumber(rowPct, 1)}%)
                                    </span>
                                  )}
                                </div>
                                {/* Mini bar */}
                                <div className="mt-1 h-1 w-full rounded-full bg-gray-100">
                                  <div
                                    className="h-1 rounded-full bg-green-400"
                                    style={{ width: `${Math.min(rowPct, 100)}%` }}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  );
                })}

                {/* Grand total */}
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                    <td className="px-4 py-3 text-gray-900" colSpan={4}>
                      รวมทั้งหมด
                    </td>
                    <td className="px-4 py-3 text-right text-lg text-green-600">
                      {formatCurrency(grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
