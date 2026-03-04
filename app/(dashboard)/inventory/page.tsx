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
import {
  cn,
  formatNumber,
  formatCurrency,
  formatDate,
} from "@/lib/utils";
import {
  calculateTotalStock,
  calculateTotalValue,
  calculateWAC,
} from "@/lib/utils/fifo";
import {
  Search,
  Package,
  ChevronDown,
  ChevronRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Filter,
  Layers,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import type { InventoryLot, ItemWithRelations, StockSummary } from "@/types/database";

interface ItemStockRow {
  item: ItemWithRelations;
  lots: InventoryLot[];
  totalQty: number;
  totalValue: number;
  wac: number;
  lotCount: number;
  isLow: boolean;
  isOut: boolean;
}

export default function InventoryPage() {
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
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    fetchInventory(selectedBranchId || undefined);
  }, [selectedBranchId, fetchInventory]);

  const loading = masterLoading || invLoading;

  // Build stock rows
  const stockRows = useMemo<ItemStockRow[]>(() => {
    return items.map((item) => {
      const itemLots = lots.filter(
        (l) => l.item_id === item.id && l.remaining_qty > 0
      );
      const totalQty = calculateTotalStock(itemLots);
      const totalValue = calculateTotalValue(itemLots);
      const wac = calculateWAC(itemLots);
      return {
        item,
        lots: itemLots,
        totalQty,
        totalValue,
        wac,
        lotCount: itemLots.length,
        isLow: totalQty > 0 && totalQty < item.min_stock,
        isOut: totalQty === 0 && item.min_stock > 0,
      };
    });
  }, [items, lots]);

  // Apply filters
  const filteredRows = useMemo(() => {
    let rows = stockRows;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => r.item.name.toLowerCase().includes(q));
    }

    if (categoryFilter !== "all") {
      rows = rows.filter((r) => r.item.category_id === categoryFilter);
    }

    return rows;
  }, [stockRows, search, categoryFilter]);

  // Group by category for display
  const groupedRows = useMemo(() => {
    const groups = new Map<string, { categoryName: string; rows: ItemStockRow[] }>();

    for (const row of filteredRows) {
      const catId = row.item.category_id || "_none";
      const catName = row.item.category?.name || "ไม่มีหมวดหมู่";
      if (!groups.has(catId)) {
        groups.set(catId, { categoryName: catName, rows: [] });
      }
      groups.get(catId)!.rows.push(row);
    }

    return Array.from(groups.entries()).sort((a, b) =>
      a[1].categoryName.localeCompare(b[1].categoryName, "th")
    );
  }, [filteredRows]);

  const toggleExpand = useCallback((itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  // Summary
  const totalStockValue = useMemo(
    () => filteredRows.reduce((sum, r) => sum + r.totalValue, 0),
    [filteredRows]
  );
  const lowStockCount = useMemo(
    () => filteredRows.filter((r) => r.isLow || r.isOut).length,
    [filteredRows]
  );

  if (loading && items.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-1" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 lg:text-2xl">
          สต็อกสินค้า
        </h1>
        <p className="text-sm text-gray-500">
          ดูยอดสต็อกคงเหลือ รายล็อต และมูลค่า
          {selectedBranchId
            ? ` — ${getBranchById(selectedBranchId)?.name || ""}`
            : " — ทุกสาขา"}
        </p>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-white border border-gray-200 px-3 py-2">
          <Package className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            {formatNumber(filteredRows.length)} รายการ
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white border border-gray-200 px-3 py-2">
          <Layers className="h-4 w-4 text-green-500" />
          <span className="text-sm text-gray-600">
            มูลค่ารวม{" "}
            <span className="font-semibold text-gray-900">
              {formatCurrency(totalStockValue)}
            </span>
          </span>
        </div>
        {lowStockCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-sm text-amber-700">
              {formatNumber(lowStockCount)} สินค้าต่ำกว่าขั้นต่ำ
            </span>
          </div>
        )}
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
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block">
        {filteredRows.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="w-8 px-4 py-3" />
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    สินค้า
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    หมวดหมู่
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">
                    คงเหลือ
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">
                    WAC
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">
                    มูลค่ารวม
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">
                    ล็อต
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">
                    สถานะ
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">
                    การดำเนินการ
                  </th>
                </tr>
              </thead>
              <tbody>
                {groupedRows.map(([catId, group]) => (
                  <CategoryGroup
                    key={catId}
                    categoryName={group.categoryName}
                    rows={group.rows}
                    expandedItems={expandedItems}
                    onToggleExpand={toggleExpand}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 lg:hidden">
        {filteredRows.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          filteredRows.map((row) => (
            <MobileItemCard
              key={row.item.id}
              row={row}
              expanded={expandedItems.has(row.item.id)}
              onToggle={() => toggleExpand(row.item.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Desktop category group rows
function CategoryGroup({
  categoryName,
  rows,
  expandedItems,
  onToggleExpand,
}: {
  categoryName: string;
  rows: ItemStockRow[];
  expandedItems: Set<string>;
  onToggleExpand: (id: string) => void;
}) {
  return (
    <>
      {/* Category header row */}
      <tr className="bg-gray-50/40">
        <td colSpan={9} className="px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {categoryName}
          </span>
        </td>
      </tr>
      {rows.map((row) => {
        const expanded = expandedItems.has(row.item.id);
        return (
          <DesktopItemRow
            key={row.item.id}
            row={row}
            expanded={expanded}
            onToggle={() => onToggleExpand(row.item.id)}
          />
        );
      })}
    </>
  );
}

function DesktopItemRow({
  row,
  expanded,
  onToggle,
}: {
  row: ItemStockRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className={cn(
          "border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer",
          expanded && "bg-orange-50/30"
        )}
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <button className="text-gray-400 hover:text-gray-600">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </td>
        <td className="px-4 py-3">
          <p className="font-medium text-gray-900">{row.item.name}</p>
          <p className="text-xs text-gray-400">{row.item.unit?.name || "—"}</p>
        </td>
        <td className="px-4 py-3 text-gray-600">
          {row.item.category?.name || "—"}
        </td>
        <td className="px-4 py-3 text-right font-semibold text-gray-900">
          {formatNumber(row.totalQty, 2)}
        </td>
        <td className="px-4 py-3 text-right text-gray-600">
          {formatNumber(row.wac, 2)} บาท
        </td>
        <td className="px-4 py-3 text-right font-medium text-gray-900">
          {formatCurrency(row.totalValue)}
        </td>
        <td className="px-4 py-3 text-center text-gray-500">
          {row.lotCount}
        </td>
        <td className="px-4 py-3 text-center">
          {row.isOut ? (
            <Badge variant="destructive">หมดสต็อก</Badge>
          ) : row.isLow ? (
            <Badge variant="warning">ใกล้หมด</Badge>
          ) : (
            <Badge variant="success">ปกติ</Badge>
          )}
        </td>
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50">
              <ArrowDownToLine className="mr-1 h-3 w-3" />
              รับเข้า
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
              <ArrowUpFromLine className="mr-1 h-3 w-3" />
              เบิกออก
            </Button>
          </div>
        </td>
      </tr>
      {/* Expanded lot details */}
      {expanded && row.lots.length > 0 && (
        <tr>
          <td colSpan={9} className="bg-orange-50/20 px-4 py-0">
            <div className="py-3 pl-8">
              <p className="mb-2 text-xs font-semibold text-gray-500">
                รายละเอียดล็อต ({row.lots.length} ล็อต)
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400">
                    <th className="pb-1.5 text-left font-medium">ล็อต</th>
                    <th className="pb-1.5 text-left font-medium">
                      วันที่รับ
                    </th>
                    <th className="pb-1.5 text-left font-medium">
                      วันหมดอายุ
                    </th>
                    <th className="pb-1.5 text-right font-medium">
                      คงเหลือ
                    </th>
                    <th className="pb-1.5 text-right font-medium">
                      ราคาต่อหน่วย
                    </th>
                    <th className="pb-1.5 text-right font-medium">
                      มูลค่า
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {row.lots
                    .sort(
                      (a, b) =>
                        new Date(a.received_date).getTime() -
                        new Date(b.received_date).getTime()
                    )
                    .map((lot) => {
                      const isExpiringSoon =
                        lot.expiry_date &&
                        new Date(lot.expiry_date).getTime() -
                          Date.now() <
                          7 * 24 * 60 * 60 * 1000;
                      return (
                        <tr
                          key={lot.id}
                          className="border-t border-gray-100/80"
                        >
                          <td className="py-1.5 font-mono text-gray-500">
                            {lot.lot_id}
                          </td>
                          <td className="py-1.5 text-gray-600">
                            {formatDate(lot.received_date)}
                          </td>
                          <td className="py-1.5">
                            {lot.expiry_date ? (
                              <span
                                className={cn(
                                  isExpiringSoon
                                    ? "text-red-600 font-medium"
                                    : "text-gray-600"
                                )}
                              >
                                {formatDate(lot.expiry_date)}
                                {isExpiringSoon && " ⚠"}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="py-1.5 text-right font-medium text-gray-800">
                            {formatNumber(lot.remaining_qty, 2)}
                          </td>
                          <td className="py-1.5 text-right text-gray-600">
                            {lot.unit_price != null
                              ? `${formatNumber(lot.unit_price, 2)} บาท`
                              : "—"}
                          </td>
                          <td className="py-1.5 text-right font-medium text-gray-800">
                            {lot.unit_price != null
                              ? formatCurrency(
                                  lot.remaining_qty * lot.unit_price
                                )
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
      {expanded && row.lots.length === 0 && (
        <tr>
          <td colSpan={9} className="bg-orange-50/20 px-4 py-4">
            <p className="pl-8 text-xs text-gray-400">
              ไม่มีล็อตสินค้าคงเหลือ
            </p>
          </td>
        </tr>
      )}
    </>
  );
}

// Mobile card
function MobileItemCard({
  row,
  expanded,
  onToggle,
}: {
  row: ItemStockRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <button
        className="w-full text-left p-4"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900 truncate">
                {row.item.name}
              </p>
              {row.isOut ? (
                <Badge variant="destructive" className="text-[10px] px-1.5">
                  หมด
                </Badge>
              ) : row.isLow ? (
                <Badge variant="warning" className="text-[10px] px-1.5">
                  ใกล้หมด
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {row.item.category?.name || "ไม่มีหมวดหมู่"} ·{" "}
              {row.item.unit?.name || "—"}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold text-gray-900">
              {formatNumber(row.totalQty, 2)}
            </p>
            <p className="text-[11px] text-gray-400">
              {row.item.unit?.name || ""}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>WAC: {formatNumber(row.wac, 2)} บาท</span>
          <span>มูลค่า: {formatCurrency(row.totalValue)}</span>
          <span className="flex items-center gap-1">
            {row.lotCount} ล็อต
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
          {row.lots.length === 0 ? (
            <p className="text-xs text-gray-400">ไม่มีล็อตสินค้าคงเหลือ</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500">
                รายละเอียดล็อต
              </p>
              {row.lots
                .sort(
                  (a, b) =>
                    new Date(a.received_date).getTime() -
                    new Date(b.received_date).getTime()
                )
                .map((lot) => (
                  <div
                    key={lot.id}
                    className="rounded-lg bg-white border border-gray-100 p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-gray-500">
                        {lot.lot_id}
                      </span>
                      <span className="font-medium text-gray-800">
                        {formatNumber(lot.remaining_qty, 2)}{" "}
                        {row.item.unit?.name || ""}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-gray-400">
                      <span>
                        <Calendar className="mr-1 inline h-3 w-3" />
                        {formatDate(lot.received_date)}
                      </span>
                      <span>
                        {lot.unit_price != null
                          ? `${formatNumber(lot.unit_price, 2)} บาท/หน่วย`
                          : "—"}
                      </span>
                    </div>
                    {lot.expiry_date && (
                      <p className="mt-1 text-gray-400">
                        หมดอายุ: {formatDate(lot.expiry_date)}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs text-green-600 border-green-200 hover:bg-green-50"
            >
              <ArrowDownToLine className="mr-1 h-3 w-3" />
              รับเข้า
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs text-red-600 border-red-200 hover:bg-red-50"
            >
              <ArrowUpFromLine className="mr-1 h-3 w-3" />
              เบิกออก
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-50 mb-4">
        <Package className="h-7 w-7 text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-700">
        {search ? "ไม่พบสินค้าที่ค้นหา" : "ยังไม่มีข้อมูลสต็อก"}
      </p>
      <p className="text-xs text-gray-400 mt-1">
        {search
          ? `ไม่พบสินค้าที่ตรงกับ "${search}"`
          : "เริ่มเพิ่มสินค้าและรับเข้าสต็อกเพื่อดูข้อมูล"}
      </p>
    </div>
  );
}
