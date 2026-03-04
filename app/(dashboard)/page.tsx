"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useMasterDataStore } from "@/stores/master-data";
import { useInventoryStore } from "@/stores/inventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  formatCurrency,
  formatNumber,
  formatRelativeTime,
  getTransactionTypeLabel,
  cn,
} from "@/lib/utils";
import {
  calculateTotalStock,
  calculateTotalValue,
  calculateWAC,
} from "@/lib/utils/fifo";
import {
  Package,
  TrendingDown,
  ArrowRightLeft,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Repeat2,
  SlidersHorizontal,
} from "lucide-react";
import type { InventoryLot, ItemWithRelations } from "@/types/database";

// Compute stock summary for a single item across relevant lots
function getItemStock(item: ItemWithRelations, lots: InventoryLot[]) {
  const itemLots = lots.filter(
    (l) => l.item_id === item.id && l.remaining_qty > 0
  );
  const totalQty = calculateTotalStock(itemLots);
  const totalValue = calculateTotalValue(itemLots);
  const wac = calculateWAC(itemLots);
  const isLow = totalQty < item.min_stock && totalQty > 0;
  const isOut = totalQty === 0 && item.min_stock > 0;
  return { totalQty, totalValue, wac, isLow, isOut, lotCount: itemLots.length };
}

const txTypeIcons: Record<string, React.ElementType> = {
  in: ArrowDownToLine,
  out: ArrowUpFromLine,
  transfer: Repeat2,
  adjust: SlidersHorizontal,
};

export default function DashboardPage() {
  const {
    items,
    branches,
    selectedBranchId,
    loading: masterLoading,
    fetchAll,
    getBranchById,
    getItemById,
  } = useMasterDataStore();
  const {
    lots,
    transactions,
    loading: invLoading,
    fetchInventory,
    fetchTransactions,
  } = useInventoryStore();

  useEffect(() => {
    fetchAll();
    fetchTransactions(10);
  }, [fetchAll, fetchTransactions]);

  useEffect(() => {
    fetchInventory(selectedBranchId || undefined);
  }, [selectedBranchId, fetchInventory]);

  const loading = masterLoading || invLoading;

  // Compute aggregated data
  const { totalItems, totalValue, lowStockItems, outOfStockCount } =
    useMemo(() => {
      if (items.length === 0)
        return {
          totalItems: 0,
          totalValue: 0,
          lowStockItems: [] as (ItemWithRelations & {
            totalQty: number;
            isOut: boolean;
          })[],
          outOfStockCount: 0,
        };

      let value = 0;
      let outCount = 0;
      const lowItems: (ItemWithRelations & {
        totalQty: number;
        isOut: boolean;
      })[] = [];

      for (const item of items) {
        const stock = getItemStock(item, lots);
        value += stock.totalValue;
        if (stock.isLow || stock.isOut) {
          lowItems.push({ ...item, totalQty: stock.totalQty, isOut: stock.isOut });
        }
        if (stock.isOut) outCount++;
      }

      return {
        totalItems: items.length,
        totalValue: value,
        lowStockItems: lowItems,
        outOfStockCount: outCount,
      };
    }, [items, lots]);

  const recentTx = transactions.slice(0, 10);

  // Loading skeleton
  if (loading && items.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-1" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  const branchName = selectedBranchId
    ? getBranchById(selectedBranchId)?.name
    : null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 lg:text-2xl">
          แดชบอร์ด
        </h1>
        <p className="text-sm text-gray-500">
          ภาพรวมสต็อกสินค้า
          {branchName ? ` — ${branchName}` : " — ทุกสาขา"}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Card>
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(totalItems)}
              </p>
              <p className="text-xs text-gray-500">รายการสินค้าทั้งหมด</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-gray-900 truncate">
                {formatCurrency(totalValue)}
              </p>
              <p className="text-xs text-gray-500">มูลค่าสต็อกรวม</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
                <TrendingDown className="h-5 w-5 text-amber-600" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(lowStockItems.length)}
              </p>
              <p className="text-xs text-gray-500">สินค้าใกล้หมด</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                <ArrowRightLeft className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(recentTx.length)}
              </p>
              <p className="text-xs text-gray-500">รายการล่าสุด</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Low stock alerts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                สินค้าใกล้หมด / หมดสต็อก
              </CardTitle>
              <Link href="/inventory">
                <Button variant="ghost" size="sm" className="text-xs">
                  ดูทั้งหมด
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {lowStockItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 mb-3">
                  <Package className="h-6 w-6 text-green-500" />
                </div>
                <p className="text-sm font-medium text-gray-700">
                  สต็อกสินค้าเพียงพอ
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  ไม่มีสินค้าที่ต่ำกว่าจุดสั่งซื้อขั้นต่ำ
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {lowStockItems.slice(0, 8).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        ขั้นต่ำ: {formatNumber(item.min_stock)}{" "}
                        {item.unit?.name || ""}
                      </p>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        {formatNumber(item.totalQty)}
                      </span>
                      <Badge variant={item.isOut ? "destructive" : "warning"}>
                        {item.isOut ? "หมด" : "ใกล้หมด"}
                      </Badge>
                    </div>
                  </div>
                ))}
                {lowStockItems.length > 8 && (
                  <p className="text-center text-xs text-gray-400 pt-1">
                    และอีก {lowStockItems.length - 8} รายการ
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent transactions */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowRightLeft className="h-4 w-4 text-purple-500" />
                รายการเคลื่อนไหวล่าสุด
              </CardTitle>
              <Link href="/history">
                <Button variant="ghost" size="sm" className="text-xs">
                  ดูทั้งหมด
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentTx.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 mb-3">
                  <ArrowRightLeft className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">
                  ยังไม่มีรายการ
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  รายการเคลื่อนไหวจะแสดงที่นี่
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {recentTx.map((tx) => {
                  const txType = getTransactionTypeLabel(tx.type);
                  const TxIcon = txTypeIcons[tx.type] || ArrowRightLeft;
                  const itemName = tx.item?.name || "—";
                  const branchDisplayName = tx.branch?.name || "—";
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                          tx.type === "in" && "bg-green-50",
                          tx.type === "out" && "bg-red-50",
                          tx.type === "transfer" && "bg-blue-50",
                          tx.type === "adjust" && "bg-orange-50"
                        )}
                      >
                        <TxIcon
                          className={cn(
                            "h-4 w-4",
                            tx.type === "in" && "text-green-600",
                            tx.type === "out" && "text-red-600",
                            tx.type === "transfer" && "text-blue-600",
                            tx.type === "adjust" && "text-orange-600"
                          )}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("text-xs font-semibold", txType.color)}>
                            {txType.label}
                          </span>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs text-gray-500 truncate">
                            {branchDisplayName}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 truncate">
                          {itemName}
                          <span className="text-gray-400">
                            {" "}
                            × {formatNumber(tx.amount)}
                          </span>
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[11px] text-gray-400">
                          {formatRelativeTime(tx.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
