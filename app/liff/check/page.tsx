"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  Loader2,
  ChevronDown,
  ChevronUp,
  Package,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { formatNumber, formatDate } from "@/lib/utils";
import type { Branch, ItemWithRelations, InventoryLot } from "@/types/database";

interface StockItem {
  item: ItemWithRelations;
  totalQty: number;
  lots: InventoryLot[];
  status: "ok" | "low" | "out";
}

export default function LiffCheckStockPage() {
  const router = useRouter();

  // Data
  const [items, setItems] = useState<ItemWithRelations[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("all");

  // Expanded item (to show lot details)
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();
        const [itemsRes, branchesRes, lotsRes] = await Promise.all([
          supabase
            .from("items")
            .select("*, unit:units(*), category:categories(*)")
            .order("name"),
          supabase.from("branches").select("*").order("name"),
          supabase
            .from("inventory")
            .select("*")
            .gt("remaining_qty", 0)
            .order("received_date", { ascending: true }),
        ]);
        setItems((itemsRes.data as ItemWithRelations[]) || []);
        setBranches((branchesRes.data as Branch[]) || []);
        setLots((lotsRes.data as InventoryLot[]) || []);
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Build stock items with aggregation
  const stockItems = useMemo((): StockItem[] => {
    return items
      .map((item) => {
        const itemLots = lots.filter((l) => {
          if (l.item_id !== item.id) return false;
          if (selectedBranchId !== "all" && l.branch_id !== selectedBranchId)
            return false;
          return true;
        });

        const totalQty = itemLots.reduce((sum, l) => sum + l.remaining_qty, 0);
        let status: "ok" | "low" | "out" = "ok";
        if (totalQty <= 0) {
          status = "out";
        } else if (totalQty <= item.min_stock) {
          status = "low";
        }

        return { item, totalQty, lots: itemLots, status };
      })
      .filter((si) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          si.item.name.toLowerCase().includes(q) ||
          si.item.category?.name?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Sort by status: out -> low -> ok, then by name
        const order = { out: 0, low: 1, ok: 2 };
        if (order[a.status] !== order[b.status]) {
          return order[a.status] - order[b.status];
        }
        return a.item.name.localeCompare(b.item.name, "th");
      });
  }, [items, lots, selectedBranchId, search]);

  // Stats
  const stats = useMemo(() => {
    const total = stockItems.length;
    const low = stockItems.filter((s) => s.status === "low").length;
    const out = stockItems.filter((s) => s.status === "out").length;
    return { total, low, out };
  }, [stockItems]);

  // Branch name lookup for lot display
  const branchMap = useMemo(() => {
    const map = new Map<string, string>();
    branches.forEach((b) => map.set(b.id, b.name));
    return map;
  }, [branches]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-3rem)]">
      {/* Sub-header */}
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push("/liff")}
          className="p-1 hover:bg-blue-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-blue-700" />
        </button>
        <h2 className="text-base font-semibold text-blue-800">เช็คสต็อก</h2>
      </div>

      {/* Search & Filter */}
      <div className="bg-white border-b border-gray-200 p-3 space-y-2 sticky top-12 z-40">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="ค้นหาสินค้า..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">ทุกสาขา</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* Stats Bar */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-3 text-xs">
        <span className="text-gray-500">
          ทั้งหมด <strong className="text-gray-900">{stats.total}</strong>
        </span>
        {stats.low > 0 && (
          <Badge variant="warning" className="text-xs">
            ใกล้หมด {stats.low}
          </Badge>
        )}
        {stats.out > 0 && (
          <Badge variant="destructive" className="text-xs">
            หมด {stats.out}
          </Badge>
        )}
      </div>

      {/* Stock List */}
      <div className="flex-1">
        {stockItems.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="h-12 w-12 text-gray-300 mx-auto" />
            <p className="mt-3 text-sm text-gray-500">
              {search ? "ไม่พบสินค้าที่ค้นหา" : "ยังไม่มีข้อมูลสต็อก"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {stockItems.map(({ item, totalQty, lots: itemLots, status }) => {
              const isExpanded = expandedItemId === item.id;

              return (
                <div key={item.id} className="bg-white">
                  {/* Item Row */}
                  <button
                    onClick={() =>
                      setExpandedItemId(isExpanded ? null : item.id)
                    }
                    className="w-full flex items-center px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    {/* Status indicator */}
                    <div
                      className={`w-1.5 h-10 rounded-full mr-3 flex-shrink-0 ${
                        status === "out"
                          ? "bg-red-500"
                          : status === "low"
                            ? "bg-amber-400"
                            : "bg-green-500"
                      }`}
                    />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.category?.name || "ไม่มีหมวดหมู่"}
                        {itemLots.length > 0 && ` / ${itemLots.length} ล็อต`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 ml-2">
                      <div className="text-right">
                        <p
                          className={`text-sm font-semibold ${
                            status === "out"
                              ? "text-red-600"
                              : status === "low"
                                ? "text-amber-600"
                                : "text-gray-900"
                          }`}
                        >
                          {formatNumber(totalQty)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.unit?.name || ""}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Lot Details */}
                  {isExpanded && (
                    <div className="bg-gray-50 px-4 pb-3">
                      {itemLots.length === 0 ? (
                        <p className="text-xs text-gray-500 py-2">
                          ไม่มีสต็อกในสาขาที่เลือก
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex text-xs text-gray-500 font-medium py-1 border-b border-gray-200">
                            <span className="flex-1">ล็อต</span>
                            {selectedBranchId === "all" && (
                              <span className="w-20 text-center">สาขา</span>
                            )}
                            <span className="w-16 text-right">จำนวน</span>
                            <span className="w-20 text-right">หมดอายุ</span>
                          </div>
                          {itemLots.map((lot) => (
                            <div
                              key={lot.id}
                              className="flex items-center text-xs py-1"
                            >
                              <span className="flex-1 text-gray-600 truncate">
                                {lot.lot_id.replace("LOT-", "")}
                              </span>
                              {selectedBranchId === "all" && (
                                <span className="w-20 text-center text-gray-500 truncate">
                                  {branchMap.get(lot.branch_id) || "-"}
                                </span>
                              )}
                              <span className="w-16 text-right font-medium text-gray-900">
                                {formatNumber(lot.remaining_qty)}
                              </span>
                              <span
                                className={`w-20 text-right ${
                                  lot.expiry_date &&
                                  new Date(lot.expiry_date) <
                                    new Date(
                                      Date.now() + 7 * 24 * 60 * 60 * 1000
                                    )
                                    ? "text-red-500"
                                    : "text-gray-500"
                                }`}
                              >
                                {lot.expiry_date
                                  ? formatDate(lot.expiry_date)
                                  : "-"}
                              </span>
                            </div>
                          ))}
                          {/* Summary row */}
                          <div className="flex items-center text-xs pt-1.5 border-t border-gray-200 font-medium">
                            <span className="flex-1 text-gray-700">รวม</span>
                            {selectedBranchId === "all" && (
                              <span className="w-20" />
                            )}
                            <span className="w-16 text-right text-gray-900">
                              {formatNumber(totalQty)}
                            </span>
                            <span className="w-20 text-right text-gray-500">
                              {item.unit?.name || ""}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Min stock indicator */}
                      {item.min_stock > 0 && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              totalQty <= 0
                                ? "bg-red-500"
                                : totalQty <= item.min_stock
                                  ? "bg-amber-400"
                                  : "bg-green-500"
                            }`}
                          />
                          สต็อกขั้นต่ำ: {formatNumber(item.min_stock)}{" "}
                          {item.unit?.name || ""}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
