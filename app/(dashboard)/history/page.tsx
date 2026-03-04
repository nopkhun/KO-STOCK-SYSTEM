"use client";

import { useEffect, useState, useMemo } from "react";
import { useInventoryStore } from "@/stores/inventory";
import { useMasterDataStore } from "@/stores/master-data";
import { cn, formatDateTime, formatCurrency, formatNumber, getTransactionTypeLabel } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { TransactionType } from "@/types/database";
import {
  Search,
  Filter,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  SlidersHorizontal,
  X,
  History,
  Package,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const TRANSACTION_TYPE_OPTIONS: { value: TransactionType | "all"; label: string }[] = [
  { value: "all", label: "ทุกประเภท" },
  { value: "in", label: "รับเข้า" },
  { value: "out", label: "เบิกออก" },
  { value: "transfer", label: "โอนย้าย" },
  { value: "adjust", label: "ปรับยอด" },
];

function getTypeBadgeVariant(type: string): "success" | "destructive" | "default" | "warning" {
  switch (type) {
    case "in":
      return "success";
    case "out":
      return "destructive";
    case "transfer":
      return "default";
    case "adjust":
      return "warning";
    default:
      return "secondary" as "warning";
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case "in":
      return ArrowDownCircle;
    case "out":
      return ArrowUpCircle;
    case "transfer":
      return ArrowLeftRight;
    case "adjust":
      return SlidersHorizontal;
    default:
      return Package;
  }
}

export default function HistoryPage() {
  const { transactions, fetchTransactions } = useInventoryStore();
  const { branches, items, suppliers, fetchAll, loading: masterLoading } = useMasterDataStore();

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [itemFilter, setItemFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchTransactions(200), fetchAll()]);
      setLoading(false);
    };
    load();
  }, [fetchTransactions, fetchAll]);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      // Type filter
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;

      // Branch filter
      if (branchFilter !== "all" && tx.branch_id !== branchFilter) return false;

      // Item filter
      if (itemFilter !== "all" && tx.item_id !== itemFilter) return false;

      // Search
      if (search) {
        const q = search.toLowerCase();
        const itemName = tx.item?.name?.toLowerCase() || "";
        const branchName = tx.branch?.name?.toLowerCase() || "";
        const note = tx.note?.toLowerCase() || "";
        const performer = tx.performer?.username?.toLowerCase() || "";
        if (
          !itemName.includes(q) &&
          !branchName.includes(q) &&
          !note.includes(q) &&
          !performer.includes(q)
        )
          return false;
      }

      return true;
    });
  }, [transactions, typeFilter, branchFilter, itemFilter, search]);

  const activeFilterCount = [
    typeFilter !== "all",
    branchFilter !== "all",
    itemFilter !== "all",
  ].filter(Boolean).length;

  const clearFilters = () => {
    setTypeFilter("all");
    setBranchFilter("all");
    setItemFilter("all");
    setSearch("");
  };

  if (loading || masterLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
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
          <h1 className="text-xl font-bold text-gray-900">ประวัติรายการ</h1>
          <p className="text-sm text-gray-500">
            {filtered.length} รายการ
            {activeFilterCount > 0 && ` (กรอง ${activeFilterCount} เงื่อนไข)`}
          </p>
        </div>
      </div>

      {/* Search & Filter Toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="ค้นหาสินค้า, สาขา, หมายเหตุ..."
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
        <Button
          variant={showFilters || activeFilterCount > 0 ? "default" : "outline"}
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          className="relative shrink-0"
        >
          <Filter className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">ตัวกรอง</p>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs text-orange-600 hover:text-orange-700 font-medium"
              >
                ล้างทั้งหมด
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Type filter */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">ประเภท</label>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TransactionType | "all")}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Branch filter */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">สาขา</label>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสาขา</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Item filter */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">สินค้า</label>
              <Select value={itemFilter} onValueChange={setItemFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสินค้า</SelectItem>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Transaction List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-16">
          <History className="h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-500">ไม่พบรายการ</p>
          <p className="text-xs text-gray-400">
            {activeFilterCount > 0 || search
              ? "ลองปรับเงื่อนไขการค้นหา"
              : "ยังไม่มีรายการเคลื่อนไหว"}
          </p>
          {(activeFilterCount > 0 || search) && (
            <Button variant="ghost" size="sm" className="mt-3" onClick={clearFilters}>
              ล้างตัวกรอง
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
                  <th className="px-4 py-3 text-left font-medium text-gray-500">วันที่</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">ประเภท</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">สินค้า</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">จำนวน</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">สาขา</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">รายละเอียด</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">ผู้ทำรายการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((tx) => {
                  const typeInfo = getTransactionTypeLabel(tx.type);
                  const badgeVariant = getTypeBadgeVariant(tx.type);

                  return (
                    <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDateTime(tx.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={badgeVariant} className="text-[11px]">
                          {typeInfo.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {tx.item?.name || "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        <span className={cn(
                          "font-semibold",
                          tx.type === "in" ? "text-green-600" : tx.type === "out" ? "text-red-600" : "text-gray-900"
                        )}>
                          {tx.type === "in" ? "+" : tx.type === "out" ? "-" : ""}
                          {formatNumber(tx.amount, 2)}
                        </span>
                        {tx.unit && (
                          <span className="ml-1 text-gray-400 text-xs">{tx.unit}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <div>
                          {tx.branch?.name || "-"}
                          {tx.type === "transfer" && tx.target_branch && (
                            <span className="text-blue-600">
                              {" "}→ {tx.target_branch.name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[200px]">
                        <div className="space-y-0.5">
                          {tx.type === "in" && tx.supplier && (
                            <div className="text-xs">
                              <span className="text-gray-400">ผู้จัดส่ง:</span>{" "}
                              {tx.supplier.name}
                            </div>
                          )}
                          {tx.type === "in" && tx.unit_price != null && (
                            <div className="text-xs">
                              <span className="text-gray-400">ราคา/หน่วย:</span>{" "}
                              {formatCurrency(tx.unit_price)}
                            </div>
                          )}
                          {tx.type === "out" && tx.out_reason && (
                            <div className="text-xs">
                              <span className="text-gray-400">เหตุผล:</span>{" "}
                              {tx.out_reason}
                            </div>
                          )}
                          {tx.note && (
                            <div className="truncate text-xs text-gray-400" title={tx.note}>
                              {tx.note}
                            </div>
                          )}
                          {!tx.note && !tx.supplier && !tx.out_reason && (
                            <span className="text-xs text-gray-300">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {tx.performer?.username || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-2 lg:hidden">
            {filtered.map((tx) => {
              const typeInfo = getTransactionTypeLabel(tx.type);
              const badgeVariant = getTypeBadgeVariant(tx.type);
              const TypeIcon = getTypeIcon(tx.type);
              const isExpanded = expandedId === tx.id;

              return (
                <div
                  key={tx.id}
                  className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <div className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      tx.type === "in" && "bg-green-50 text-green-600",
                      tx.type === "out" && "bg-red-50 text-red-600",
                      tx.type === "transfer" && "bg-blue-50 text-blue-600",
                      tx.type === "adjust" && "bg-amber-50 text-amber-600"
                    )}>
                      <TypeIcon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {tx.item?.name || "-"}
                        </span>
                        <Badge variant={badgeVariant} className="text-[10px] shrink-0">
                          {typeInfo.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                        <span>{formatDateTime(tx.created_at)}</span>
                        <span>·</span>
                        <span>{tx.branch?.name || "-"}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={cn(
                        "text-sm font-semibold font-mono tabular-nums",
                        tx.type === "in" ? "text-green-600" : tx.type === "out" ? "text-red-600" : "text-gray-900"
                      )}>
                        {tx.type === "in" ? "+" : tx.type === "out" ? "-" : ""}
                        {formatNumber(tx.amount, 2)}
                      </span>
                      {tx.unit && (
                        <p className="text-[10px] text-gray-400">{tx.unit}</p>
                      )}
                    </div>

                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-gray-300" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-gray-300" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-2.5 space-y-1.5">
                      {tx.type === "transfer" && tx.target_branch && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">โอนไป</span>
                          <span className="text-blue-600 font-medium">{tx.target_branch.name}</span>
                        </div>
                      )}
                      {tx.type === "in" && tx.supplier && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">ผู้จัดส่ง</span>
                          <span className="text-gray-700">{tx.supplier.name}</span>
                        </div>
                      )}
                      {tx.type === "in" && tx.unit_price != null && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">ราคา/หน่วย</span>
                          <span className="text-gray-700">{formatCurrency(tx.unit_price)}</span>
                        </div>
                      )}
                      {tx.type === "in" && tx.total_price != null && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">มูลค่ารวม</span>
                          <span className="font-medium text-gray-900">{formatCurrency(tx.total_price)}</span>
                        </div>
                      )}
                      {tx.type === "out" && tx.out_reason && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">เหตุผล</span>
                          <span className="text-gray-700">{tx.out_reason}</span>
                        </div>
                      )}
                      {tx.note && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">หมายเหตุ</span>
                          <span className="text-gray-700 text-right max-w-[60%]">{tx.note}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">ผู้ทำรายการ</span>
                        <span className="text-gray-700">{tx.performer?.username || "-"}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
