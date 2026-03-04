"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useMasterDataStore } from "@/stores/master-data";
import { createClient } from "@/lib/supabase/client";
import {
  formatNumber,
  formatCurrency,
  formatDate,
  formatDateTime,
  getTransactionTypeLabel,
  cn,
} from "@/lib/utils";
import type { TransactionWithRelations } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  BarChart3,
  Printer,
  Download,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRightLeft,
  Search,
  FileText,
  Filter,
  CalendarDays,
} from "lucide-react";

export default function ReportsPage() {
  const {
    branches,
    items,
    loading: masterLoading,
    fetchAll,
  } = useMasterDataStore();

  const [transactions, setTransactions] = useState<TransactionWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Filters
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [branchId, setBranchId] = useState<string>("all");
  const [itemId, setItemId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setHasSearched(true);
      const supabase = createClient();

      let query = supabase
        .from("transactions")
        .select(
          "*, item:items(id, name), branch:branches!transactions_branch_id_fkey(id, name), target_branch:branches!transactions_target_branch_id_fkey(id, name), supplier:suppliers(id, name), performer:profiles!transactions_performed_by_fkey(id, username)"
        )
        .gte("created_at", `${startDate}T00:00:00`)
        .lte("created_at", `${endDate}T23:59:59`)
        .order("created_at", { ascending: false });

      if (branchId !== "all") {
        query = query.eq("branch_id", branchId);
      }
      if (itemId !== "all") {
        query = query.eq("item_id", itemId);
      }

      const { data } = await query;
      setTransactions((data as TransactionWithRelations[]) || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, branchId, itemId]);

  // Summary calculations
  const summary = useMemo(() => {
    const filtered = transactions.filter(
      (t) =>
        !searchTerm ||
        t.item?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.note?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalIn = filtered
      .filter((t) => t.type === "in")
      .reduce((sum, t) => sum + (t.total_price || t.amount * (t.unit_price || 0)), 0);
    const totalOut = filtered
      .filter((t) => t.type === "out")
      .reduce((sum, t) => sum + (t.out_value || t.amount * (t.unit_price || 0)), 0);
    const totalTransfer = filtered.filter((t) => t.type === "transfer").length;
    const totalAdjust = filtered.filter((t) => t.type === "adjust").length;

    const inCount = filtered.filter((t) => t.type === "in").length;
    const outCount = filtered.filter((t) => t.type === "out").length;

    return { filtered, totalIn, totalOut, totalTransfer, totalAdjust, inCount, outCount };
  }, [transactions, searchTerm]);

  const handlePrint = () => {
    window.print();
  };

  if (masterLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            รายงานความเคลื่อนไหวสต็อก
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            ดูประวัติรับเข้า เบิกออก โอนย้าย ในช่วงเวลาที่กำหนด
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

      {/* Filters */}
      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            ตัวกรอง
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs">
                <CalendarDays className="h-3.5 w-3.5" />
                วันที่เริ่มต้น
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs">
                <CalendarDays className="h-3.5 w-3.5" />
                วันที่สิ้นสุด
              </Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">สาขา</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกสาขา" />
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
            <div className="space-y-2">
              <Label className="text-xs">สินค้า</Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกสินค้า" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกรายการ</SelectItem>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={fetchTransactions} disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              {loading ? "กำลังค้นหา..." : "ค้นหา"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Print header (only visible when printing) */}
      <div className="hidden print:block">
        <h2 className="text-lg font-bold">รายงานความเคลื่อนไหวสต็อก</h2>
        <p className="text-sm text-gray-500">
          ช่วงวันที่: {formatDate(startDate)} - {formatDate(endDate)}
          {branchId !== "all" && ` | สาขา: ${branches.find((b) => b.id === branchId)?.name}`}
          {itemId !== "all" && ` | สินค้า: ${items.find((i) => i.id === itemId)?.name}`}
        </p>
      </div>

      {/* Summary cards */}
      {hasSearched && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100">
                <ArrowDownCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">รับเข้า ({summary.inCount})</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(summary.totalIn)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-100">
                <ArrowUpCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">เบิกออก ({summary.outCount})</p>
                <p className="text-xl font-bold text-red-600">
                  {formatCurrency(summary.totalOut)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                <ArrowRightLeft className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">โอนย้าย</p>
                <p className="text-xl font-bold text-blue-600">
                  {summary.totalTransfer} รายการ
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-100">
                <BarChart3 className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">ทั้งหมด</p>
                <p className="text-xl font-bold text-gray-900">
                  {summary.filtered.length} รายการ
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transactions table */}
      {hasSearched && (
        <>
          {/* Search within results */}
          <div className="relative print:hidden">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-10"
              placeholder="ค้นหาในผลลัพธ์..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : summary.filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <FileText className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-lg font-medium text-gray-700">ไม่พบรายการ</p>
                <p className="mt-1 text-sm text-gray-400">
                  ไม่มีรายการเคลื่อนไหวในช่วงเวลาที่เลือก
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
                        <th className="whitespace-nowrap px-4 py-3">วันเวลา</th>
                        <th className="whitespace-nowrap px-4 py-3">ประเภท</th>
                        <th className="whitespace-nowrap px-4 py-3">สินค้า</th>
                        <th className="whitespace-nowrap px-4 py-3">สาขา</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right">จำนวน</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right">มูลค่า</th>
                        <th className="whitespace-nowrap px-4 py-3">หมายเหตุ</th>
                        <th className="whitespace-nowrap px-4 py-3">ผู้ทำรายการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.filtered.map((t) => {
                        const typeInfo = getTransactionTypeLabel(t.type);
                        return (
                          <tr
                            key={t.id}
                            className="border-b border-gray-50 transition-colors hover:bg-gray-50"
                          >
                            <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                              {formatDateTime(t.created_at)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5">
                              <Badge
                                variant={
                                  t.type === "in"
                                    ? "success"
                                    : t.type === "out"
                                      ? "destructive"
                                      : t.type === "transfer"
                                        ? "outline"
                                        : "warning"
                                }
                              >
                                {typeInfo.label}
                              </Badge>
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 font-medium text-gray-900">
                              {t.item?.name || "-"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                              {t.branch?.name || "-"}
                              {t.type === "transfer" && t.target_branch && (
                                <span className="text-blue-500">
                                  {" "}&rarr; {t.target_branch.name}
                                </span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-right">
                              <span
                                className={cn(
                                  "font-medium",
                                  t.type === "in" ? "text-green-600" : "",
                                  t.type === "out" ? "text-red-600" : ""
                                )}
                              >
                                {t.type === "in" ? "+" : t.type === "out" ? "-" : ""}
                                {formatNumber(t.amount, 2)}
                              </span>
                              {t.unit && (
                                <span className="ml-1 text-xs text-gray-400">{t.unit}</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-right text-gray-600">
                              {t.total_price
                                ? formatCurrency(t.total_price)
                                : t.out_value
                                  ? formatCurrency(t.out_value)
                                  : "-"}
                            </td>
                            <td className="max-w-[200px] truncate px-4 py-2.5 text-gray-500">
                              {t.note || "-"}
                              {t.type === "out" && t.out_reason && (
                                <span className="ml-1 text-xs text-gray-400">
                                  ({t.out_reason})
                                </span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">
                              {t.performer?.username || "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Initial state before search */}
      {!hasSearched && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
              <BarChart3 className="h-8 w-8 text-orange-500" />
            </div>
            <p className="text-lg font-medium text-gray-700">เลือกเงื่อนไขแล้วกดค้นหา</p>
            <p className="mt-1 text-sm text-gray-400">
              ระบุช่วงวันที่ สาขา หรือสินค้า แล้วกด &quot;ค้นหา&quot; เพื่อดูรายงาน
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
