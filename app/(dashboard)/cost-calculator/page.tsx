"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useMasterDataStore } from "@/stores/master-data";
import { useInventoryStore } from "@/stores/inventory";
import { calculateWAC } from "@/lib/utils/fifo";
import { formatNumber, formatCurrency, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
  Calculator,
  Plus,
  Trash2,
  Pencil,
  ChefHat,
  DollarSign,
  TrendingUp,
  Package,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// Local types for menu management
interface LocalIngredient {
  id: string;
  type: "system" | "manual";
  item_id: string | null;
  item_name: string;
  unit: string;
  unit_price: number;
  qty: number;
}

interface LocalOverhead {
  id: string;
  label: string;
  type: "percent" | "fixed";
  value: number;
}

interface LocalMenu {
  id: string;
  name: string;
  note: string;
  target_food_cost_percent: number;
  ingredients: LocalIngredient[];
  overheads: LocalOverhead[];
  created_at: string;
}

function generateId() {
  return crypto.randomUUID();
}

// Initial sample menus
const SAMPLE_MENUS: LocalMenu[] = [
  {
    id: generateId(),
    name: "ผัดกะเพราหมูสับ",
    note: "จานยอดนิยม",
    target_food_cost_percent: 30,
    ingredients: [
      { id: generateId(), type: "manual", item_id: null, item_name: "หมูสับ", unit: "กก.", unit_price: 140, qty: 0.15 },
      { id: generateId(), type: "manual", item_id: null, item_name: "ใบกะเพรา", unit: "กำ", unit_price: 10, qty: 1 },
      { id: generateId(), type: "manual", item_id: null, item_name: "พริกขี้หนู", unit: "กก.", unit_price: 120, qty: 0.02 },
      { id: generateId(), type: "manual", item_id: null, item_name: "กระเทียม", unit: "กก.", unit_price: 80, qty: 0.02 },
      { id: generateId(), type: "manual", item_id: null, item_name: "น้ำมันพืช", unit: "ลิตร", unit_price: 50, qty: 0.03 },
      { id: generateId(), type: "manual", item_id: null, item_name: "ซอสปรุงรส", unit: "ชุด", unit_price: 5, qty: 1 },
      { id: generateId(), type: "manual", item_id: null, item_name: "ข้าวสวย", unit: "กก.", unit_price: 30, qty: 0.2 },
      { id: generateId(), type: "manual", item_id: null, item_name: "ไข่ไก่", unit: "ฟอง", unit_price: 4, qty: 1 },
    ],
    overheads: [
      { id: generateId(), label: "แก๊ส", type: "fixed", value: 3 },
      { id: generateId(), label: "บรรจุภัณฑ์", type: "fixed", value: 5 },
    ],
    created_at: new Date().toISOString(),
  },
  {
    id: generateId(),
    name: "ต้มยำกุ้ง",
    note: "เมนูซิกเนเจอร์",
    target_food_cost_percent: 35,
    ingredients: [
      { id: generateId(), type: "manual", item_id: null, item_name: "กุ้งสด", unit: "กก.", unit_price: 280, qty: 0.15 },
      { id: generateId(), type: "manual", item_id: null, item_name: "เห็ดฟาง", unit: "กก.", unit_price: 80, qty: 0.05 },
      { id: generateId(), type: "manual", item_id: null, item_name: "ตะไคร้", unit: "กก.", unit_price: 40, qty: 0.02 },
      { id: generateId(), type: "manual", item_id: null, item_name: "ใบมะกรูด", unit: "กำ", unit_price: 10, qty: 0.5 },
      { id: generateId(), type: "manual", item_id: null, item_name: "พริกน้ำ", unit: "ช้อนโต๊ะ", unit_price: 8, qty: 2 },
      { id: generateId(), type: "manual", item_id: null, item_name: "มะนาว", unit: "ลูก", unit_price: 5, qty: 2 },
      { id: generateId(), type: "manual", item_id: null, item_name: "น้ำซุป", unit: "ลิตร", unit_price: 15, qty: 0.3 },
    ],
    overheads: [
      { id: generateId(), label: "แก๊ส", type: "fixed", value: 4 },
      { id: generateId(), label: "บรรจุภัณฑ์", type: "fixed", value: 8 },
      { id: generateId(), label: "ค่าแรง", type: "percent", value: 5 },
    ],
    created_at: new Date().toISOString(),
  },
];

function calcMenuCosts(menu: LocalMenu) {
  const ingredientCost = menu.ingredients.reduce(
    (sum, ing) => sum + ing.unit_price * ing.qty,
    0
  );

  let overheadFixed = 0;
  let overheadPercent = 0;
  for (const oh of menu.overheads) {
    if (oh.type === "fixed") {
      overheadFixed += oh.value;
    } else {
      overheadPercent += oh.value;
    }
  }
  const overheadFromPercent = ingredientCost * (overheadPercent / 100);
  const totalOverhead = overheadFixed + overheadFromPercent;
  const totalCost = ingredientCost + totalOverhead;

  const targetPct = menu.target_food_cost_percent || 30;
  const recommendedPrice = totalCost > 0 ? totalCost / (targetPct / 100) : 0;

  return {
    ingredientCost,
    overheadFixed,
    overheadFromPercent,
    totalOverhead,
    totalCost,
    recommendedPrice,
    targetPct,
  };
}

export default function CostCalculatorPage() {
  const { items, loading: masterLoading, fetchAll } = useMasterDataStore();
  const { lots, fetchInventory } = useInventoryStore();

  const [menus, setMenus] = useState<LocalMenu[]>(SAMPLE_MENUS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<LocalMenu | null>(null);
  const [expandedMenuId, setExpandedMenuId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formTarget, setFormTarget] = useState(30);
  const [formIngredients, setFormIngredients] = useState<LocalIngredient[]>([]);
  const [formOverheads, setFormOverheads] = useState<LocalOverhead[]>([]);

  useEffect(() => {
    fetchAll();
    fetchInventory();
  }, [fetchAll, fetchInventory]);

  // Get WAC for a system item
  const getItemWAC = useCallback(
    (itemId: string) => {
      const itemLots = lots.filter((l) => l.item_id === itemId && l.remaining_qty > 0);
      return calculateWAC(itemLots);
    },
    [lots]
  );

  const resetForm = useCallback(() => {
    setFormName("");
    setFormNote("");
    setFormTarget(30);
    setFormIngredients([]);
    setFormOverheads([]);
    setEditingMenu(null);
  }, []);

  const openNewDialog = () => {
    resetForm();
    setFormIngredients([
      { id: generateId(), type: "manual", item_id: null, item_name: "", unit: "", unit_price: 0, qty: 0 },
    ]);
    setDialogOpen(true);
  };

  const openEditDialog = (menu: LocalMenu) => {
    setEditingMenu(menu);
    setFormName(menu.name);
    setFormNote(menu.note);
    setFormTarget(menu.target_food_cost_percent);
    setFormIngredients(menu.ingredients.map((i) => ({ ...i })));
    setFormOverheads(menu.overheads.map((o) => ({ ...o })));
    setDialogOpen(true);
  };

  const handleDuplicate = (menu: LocalMenu) => {
    const newMenu: LocalMenu = {
      ...menu,
      id: generateId(),
      name: `${menu.name} (สำเนา)`,
      ingredients: menu.ingredients.map((i) => ({ ...i, id: generateId() })),
      overheads: menu.overheads.map((o) => ({ ...o, id: generateId() })),
      created_at: new Date().toISOString(),
    };
    setMenus((prev) => [...prev, newMenu]);
  };

  const addIngredient = () => {
    setFormIngredients((prev) => [
      ...prev,
      { id: generateId(), type: "manual", item_id: null, item_name: "", unit: "", unit_price: 0, qty: 0 },
    ]);
  };

  const removeIngredient = (id: string) => {
    setFormIngredients((prev) => prev.filter((i) => i.id !== id));
  };

  const updateIngredient = (id: string, field: keyof LocalIngredient, value: string | number | null) => {
    setFormIngredients((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const updated = { ...i, [field]: value };
        // When switching to system type and selecting item, fill in details
        if (field === "item_id" && updated.type === "system" && value) {
          const item = items.find((it) => it.id === value);
          if (item) {
            updated.item_name = item.name;
            updated.unit = item.unit?.name || "";
            updated.unit_price = getItemWAC(item.id);
          }
        }
        if (field === "type" && value === "system") {
          updated.item_id = null;
          updated.item_name = "";
          updated.unit = "";
          updated.unit_price = 0;
        }
        if (field === "type" && value === "manual") {
          updated.item_id = null;
        }
        return updated;
      })
    );
  };

  const addOverhead = () => {
    setFormOverheads((prev) => [
      ...prev,
      { id: generateId(), label: "", type: "fixed", value: 0 },
    ]);
  };

  const removeOverhead = (id: string) => {
    setFormOverheads((prev) => prev.filter((o) => o.id !== id));
  };

  const updateOverhead = (id: string, field: keyof LocalOverhead, value: string | number) => {
    setFormOverheads((prev) =>
      prev.map((o) => (o.id === id ? { ...o, [field]: value } : o))
    );
  };

  const handleSave = () => {
    if (!formName.trim()) return;

    const validIngredients = formIngredients.filter(
      (i) => i.item_name.trim() && i.qty > 0
    );

    if (editingMenu) {
      setMenus((prev) =>
        prev.map((m) =>
          m.id === editingMenu.id
            ? {
                ...m,
                name: formName.trim(),
                note: formNote.trim(),
                target_food_cost_percent: formTarget,
                ingredients: validIngredients,
                overheads: formOverheads.filter((o) => o.label.trim()),
              }
            : m
        )
      );
    } else {
      const newMenu: LocalMenu = {
        id: generateId(),
        name: formName.trim(),
        note: formNote.trim(),
        target_food_cost_percent: formTarget,
        ingredients: validIngredients,
        overheads: formOverheads.filter((o) => o.label.trim()),
        created_at: new Date().toISOString(),
      };
      setMenus((prev) => [...prev, newMenu]);
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    setMenus((prev) => prev.filter((m) => m.id !== id));
    setDeleteConfirm(null);
  };

  // Summary stats
  const totalMenus = menus.length;
  const avgCost = useMemo(() => {
    if (menus.length === 0) return 0;
    return menus.reduce((sum, m) => sum + calcMenuCosts(m).totalCost, 0) / menus.length;
  }, [menus]);
  const highestCostMenu = useMemo(() => {
    if (menus.length === 0) return null;
    return menus.reduce((max, m) =>
      calcMenuCosts(m).totalCost > calcMenuCosts(max).totalCost ? m : max
    );
  }, [menus]);

  if (masterLoading) {
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
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            คำนวณต้นทุนเมนู
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            คำนวณต้นทุนวัตถุดิบ ค่าใช้จ่าย และราคาขายที่แนะนำ
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={openNewDialog}>
              <Plus className="mr-2 h-4 w-4" />
              เพิ่มเมนู
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingMenu ? "แก้ไขเมนู" : "เพิ่มเมนูใหม่"}
              </DialogTitle>
              <DialogDescription>
                กรอกข้อมูลเมนู วัตถุดิบ และค่าใช้จ่ายเพิ่มเติม
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Basic info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>ชื่อเมนู *</Label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="เช่น ผัดกะเพราหมูสับ"
                  />
                </div>
                <div className="space-y-2">
                  <Label>เป้าหมาย Food Cost %</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={formTarget}
                    onChange={(e) => setFormTarget(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>หมายเหตุ</Label>
                  <Textarea
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    placeholder="หมายเหตุเพิ่มเติม"
                    rows={2}
                  />
                </div>
              </div>

              {/* Ingredients */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <Label className="text-base font-semibold">วัตถุดิบ</Label>
                  <Button variant="outline" size="sm" onClick={addIngredient}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    เพิ่มรายการ
                  </Button>
                </div>

                {formIngredients.length === 0 && (
                  <p className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400">
                    ยังไม่มีวัตถุดิบ กดปุ่ม &quot;เพิ่มรายการ&quot;
                  </p>
                )}

                <div className="space-y-3">
                  {formIngredients.map((ing, idx) => (
                    <div
                      key={ing.id}
                      className="rounded-lg border border-gray-200 bg-gray-50/50 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">
                          รายการที่ {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeIngredient(ing.id)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">ประเภท</Label>
                          <Select
                            value={ing.type}
                            onValueChange={(v) => updateIngredient(ing.id, "type", v)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manual">กำหนดเอง</SelectItem>
                              <SelectItem value="system">เลือกจากระบบ (WAC)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {ing.type === "system" ? (
                          <div className="space-y-1">
                            <Label className="text-xs">เลือกสินค้า</Label>
                            <Select
                              value={ing.item_id || ""}
                              onValueChange={(v) => updateIngredient(ing.id, "item_id", v)}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="เลือกสินค้า..." />
                              </SelectTrigger>
                              <SelectContent>
                                {items.map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.name}
                                    {item.unit ? ` (${item.unit.name})` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Label className="text-xs">ชื่อวัตถุดิบ</Label>
                            <Input
                              className="h-9"
                              value={ing.item_name}
                              onChange={(e) =>
                                updateIngredient(ing.id, "item_name", e.target.value)
                              }
                              placeholder="ชื่อวัตถุดิบ"
                            />
                          </div>
                        )}

                        <div className="space-y-1">
                          <Label className="text-xs">หน่วย</Label>
                          <Input
                            className="h-9"
                            value={ing.unit}
                            onChange={(e) =>
                              updateIngredient(ing.id, "unit", e.target.value)
                            }
                            placeholder="กก., ลิตร"
                            disabled={ing.type === "system" && !!ing.item_id}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">ราคา/หน่วย</Label>
                            <Input
                              className="h-9"
                              type="number"
                              min={0}
                              step={0.01}
                              value={ing.unit_price || ""}
                              onChange={(e) =>
                                updateIngredient(ing.id, "unit_price", Number(e.target.value))
                              }
                              disabled={ing.type === "system" && !!ing.item_id}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">จำนวน</Label>
                            <Input
                              className="h-9"
                              type="number"
                              min={0}
                              step={0.01}
                              value={ing.qty || ""}
                              onChange={(e) =>
                                updateIngredient(ing.id, "qty", Number(e.target.value))
                              }
                            />
                          </div>
                        </div>
                      </div>

                      {ing.unit_price > 0 && ing.qty > 0 && (
                        <div className="mt-2 text-right text-xs text-gray-500">
                          รวม: <span className="font-semibold text-gray-700">{formatCurrency(ing.unit_price * ing.qty)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Overheads */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <Label className="text-base font-semibold">ค่าใช้จ่ายเพิ่มเติม (Overhead)</Label>
                  <Button variant="outline" size="sm" onClick={addOverhead}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    เพิ่ม
                  </Button>
                </div>

                {formOverheads.length === 0 && (
                  <p className="rounded-lg border border-dashed border-gray-200 py-4 text-center text-sm text-gray-400">
                    ไม่มีค่าใช้จ่ายเพิ่มเติม
                  </p>
                )}

                <div className="space-y-2">
                  {formOverheads.map((oh) => (
                    <div
                      key={oh.id}
                      className="flex items-end gap-2 rounded-lg border border-gray-200 bg-gray-50/50 p-3"
                    >
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">รายการ</Label>
                        <Input
                          className="h-9"
                          value={oh.label}
                          onChange={(e) => updateOverhead(oh.id, "label", e.target.value)}
                          placeholder="เช่น ค่าแก๊ส, บรรจุภัณฑ์"
                        />
                      </div>
                      <div className="w-28 space-y-1">
                        <Label className="text-xs">ประเภท</Label>
                        <Select
                          value={oh.type}
                          onValueChange={(v) => updateOverhead(oh.id, "type", v)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">บาท</SelectItem>
                            <SelectItem value="percent">%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-24 space-y-1">
                        <Label className="text-xs">จำนวน</Label>
                        <Input
                          className="h-9"
                          type="number"
                          min={0}
                          step={0.01}
                          value={oh.value || ""}
                          onChange={(e) => updateOverhead(oh.id, "value", Number(e.target.value))}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOverhead(oh.id)}
                        className="mb-0.5 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live preview */}
              {formIngredients.some((i) => i.qty > 0 && i.unit_price > 0) && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                  <p className="mb-2 text-sm font-semibold text-orange-800">ตัวอย่างการคำนวณ</p>
                  {(() => {
                    const preview = calcMenuCosts({
                      ...({} as LocalMenu),
                      ingredients: formIngredients,
                      overheads: formOverheads,
                      target_food_cost_percent: formTarget,
                    });
                    return (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-orange-700">วัตถุดิบ:</span>
                        <span className="text-right font-medium">{formatCurrency(preview.ingredientCost)}</span>
                        <span className="text-orange-700">Overhead:</span>
                        <span className="text-right font-medium">{formatCurrency(preview.totalOverhead)}</span>
                        <span className="border-t border-orange-200 pt-1 font-semibold text-orange-800">ต้นทุนรวม:</span>
                        <span className="border-t border-orange-200 pt-1 text-right font-bold text-orange-800">
                          {formatCurrency(preview.totalCost)}
                        </span>
                        <span className="text-orange-700">ราคาแนะนำ ({formTarget}%):</span>
                        <span className="text-right font-bold text-orange-800">
                          {formatCurrency(preview.recommendedPrice)}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">ยกเลิก</Button>
              </DialogClose>
              <Button onClick={handleSave} disabled={!formName.trim()}>
                {editingMenu ? "บันทึก" : "เพิ่มเมนู"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-100">
              <ChefHat className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">จำนวนเมนู</p>
              <p className="text-2xl font-bold text-gray-900">{totalMenus}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">ต้นทุนเฉลี่ย</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(avgCost)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-100">
              <TrendingUp className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">ต้นทุนสูงสุด</p>
              <p className="text-lg font-bold text-gray-900">
                {highestCostMenu
                  ? formatCurrency(calcMenuCosts(highestCostMenu).totalCost)
                  : "-"}
              </p>
              {highestCostMenu && (
                <p className="text-xs text-gray-400">{highestCostMenu.name}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Menu list */}
      {menus.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <Calculator className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-lg font-medium text-gray-700">ยังไม่มีเมนู</p>
            <p className="mt-1 text-sm text-gray-400">
              เริ่มต้นเพิ่มเมนูเพื่อคำนวณต้นทุน
            </p>
            <Button className="mt-4" onClick={openNewDialog}>
              <Plus className="mr-2 h-4 w-4" />
              เพิ่มเมนูแรก
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {menus.map((menu) => {
            const costs = calcMenuCosts(menu);
            const isExpanded = expandedMenuId === menu.id;

            return (
              <Card key={menu.id} className="overflow-hidden">
                {/* Menu header row */}
                <div
                  className="flex cursor-pointer items-center gap-4 p-4 transition-colors hover:bg-gray-50"
                  onClick={() => setExpandedMenuId(isExpanded ? null : menu.id)}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100">
                    <ChefHat className="h-5 w-5 text-orange-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold text-gray-900">
                        {menu.name}
                      </h3>
                      <Badge variant="secondary" className="shrink-0">
                        {menu.ingredients.length} รายการ
                      </Badge>
                    </div>
                    {menu.note && (
                      <p className="truncate text-xs text-gray-400">{menu.note}</p>
                    )}
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-sm text-gray-500">ต้นทุนรวม</p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(costs.totalCost)}
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-sm text-gray-500">
                      ราคาแนะนำ ({costs.targetPct}%)
                    </p>
                    <p className="text-lg font-bold text-orange-600">
                      {formatCurrency(costs.recommendedPrice)}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 shrink-0 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" />
                  )}
                </div>

                {/* Mobile cost display */}
                <div className="flex justify-between border-t border-gray-100 px-4 py-2 sm:hidden">
                  <div>
                    <span className="text-xs text-gray-500">ต้นทุน: </span>
                    <span className="text-sm font-bold">{formatCurrency(costs.totalCost)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">ราคาแนะนำ: </span>
                    <span className="text-sm font-bold text-orange-600">
                      {formatCurrency(costs.recommendedPrice)}
                    </span>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    <div className="p-4 space-y-4">
                      {/* Ingredients table */}
                      <div>
                        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                          <Package className="h-4 w-4" />
                          วัตถุดิบ
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                                <th className="pb-2 pr-4">รายการ</th>
                                <th className="pb-2 pr-4 text-right">ราคา/หน่วย</th>
                                <th className="pb-2 pr-4 text-right">จำนวน</th>
                                <th className="pb-2 text-right">รวม</th>
                              </tr>
                            </thead>
                            <tbody>
                              {menu.ingredients.map((ing) => (
                                <tr key={ing.id} className="border-b border-gray-50">
                                  <td className="py-1.5 pr-4">
                                    <span className="font-medium">{ing.item_name}</span>
                                    {ing.type === "system" && (
                                      <Badge variant="outline" className="ml-1.5 text-[10px]">WAC</Badge>
                                    )}
                                  </td>
                                  <td className="py-1.5 pr-4 text-right text-gray-600">
                                    {formatNumber(ing.unit_price, 2)}/{ing.unit}
                                  </td>
                                  <td className="py-1.5 pr-4 text-right text-gray-600">
                                    {formatNumber(ing.qty, 2)}
                                  </td>
                                  <td className="py-1.5 text-right font-medium">
                                    {formatNumber(ing.unit_price * ing.qty, 2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-gray-200">
                                <td colSpan={3} className="pt-2 text-right font-semibold text-gray-700">
                                  รวมวัตถุดิบ:
                                </td>
                                <td className="pt-2 text-right font-bold text-gray-900">
                                  {formatCurrency(costs.ingredientCost)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      {/* Overheads */}
                      {menu.overheads.length > 0 && (
                        <div>
                          <h4 className="mb-2 text-sm font-semibold text-gray-700">
                            Overhead
                          </h4>
                          <div className="space-y-1">
                            {menu.overheads.map((oh) => (
                              <div key={oh.id} className="flex justify-between text-sm">
                                <span className="text-gray-600">
                                  {oh.label}
                                  {oh.type === "percent" && (
                                    <span className="ml-1 text-xs text-gray-400">({oh.value}%)</span>
                                  )}
                                </span>
                                <span className="font-medium">
                                  {oh.type === "fixed"
                                    ? formatCurrency(oh.value)
                                    : formatCurrency(costs.ingredientCost * (oh.value / 100))}
                                </span>
                              </div>
                            ))}
                            <div className="flex justify-between border-t border-gray-200 pt-1 text-sm font-semibold">
                              <span>รวม Overhead:</span>
                              <span>{formatCurrency(costs.totalOverhead)}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Cost summary */}
                      <div className="rounded-lg bg-gray-50 p-4">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <p className="text-xs text-gray-500">ต้นทุนวัตถุดิบ</p>
                            <p className="text-lg font-bold text-gray-900">
                              {formatCurrency(costs.ingredientCost)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Overhead</p>
                            <p className="text-lg font-bold text-gray-900">
                              {formatCurrency(costs.totalOverhead)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">ต้นทุนรวม/จาน</p>
                            <p className="text-lg font-bold text-orange-600">
                              {formatCurrency(costs.totalCost)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">
                              ราคาแนะนำ ({costs.targetPct}%)
                            </p>
                            <p className="text-lg font-bold text-green-600">
                              {formatCurrency(costs.recommendedPrice)}
                            </p>
                          </div>
                        </div>

                        {/* Price at different food cost percentages */}
                        <div className="mt-4 border-t border-gray-200 pt-3">
                          <p className="mb-2 text-xs font-medium text-gray-500">
                            ราคาขายที่ Food Cost % ต่างๆ
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {[25, 30, 35, 40, 45].map((pct) => (
                              <div
                                key={pct}
                                className={cn(
                                  "rounded-lg px-3 py-1.5 text-center",
                                  pct === costs.targetPct
                                    ? "bg-orange-100 ring-2 ring-orange-300"
                                    : "bg-white border border-gray-200"
                                )}
                              >
                                <p className="text-[10px] text-gray-400">{pct}%</p>
                                <p className="text-sm font-bold">
                                  {formatNumber(costs.totalCost > 0 ? costs.totalCost / (pct / 100) : 0, 0)} ฿
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); openEditDialog(menu); }}
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          แก้ไข
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleDuplicate(menu); }}
                        >
                          <Copy className="mr-1.5 h-3.5 w-3.5" />
                          ทำสำเนา
                        </Button>

                        {deleteConfirm === menu.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-red-500">ยืนยันลบ?</span>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleDelete(menu.id); }}
                            >
                              ลบ
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                            >
                              ยกเลิก
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-500 hover:bg-red-50 hover:text-red-600"
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(menu.id); }}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            ลบ
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
