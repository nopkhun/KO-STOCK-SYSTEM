import type { InventoryLot } from "@/types/database";

// Sort lots by received_date ascending (oldest first = FIFO)
export function sortLotsFIFO(lots: InventoryLot[]): InventoryLot[] {
  return [...lots].sort(
    (a, b) =>
      new Date(a.received_date).getTime() -
      new Date(b.received_date).getTime()
  );
}

export interface FIFODeductionResult {
  deductions: Array<{
    lot: InventoryLot;
    deductQty: number;
    lotValue: number;
  }>;
  totalDeducted: number;
  totalValue: number;
  remaining: number; // amount that couldn't be fulfilled
}

// FIFO deduction: deduct qty from oldest lots first
export function fifoDeduct(
  lots: InventoryLot[],
  amount: number
): FIFODeductionResult {
  const sorted = sortLotsFIFO(lots.filter((l) => l.remaining_qty > 0));
  const deductions: FIFODeductionResult["deductions"] = [];
  let remaining = amount;
  let totalValue = 0;
  let totalDeducted = 0;

  for (const lot of sorted) {
    if (remaining <= 0) break;

    const deductQty = Math.min(lot.remaining_qty, remaining);
    const lotValue = deductQty * (lot.unit_price || 0);

    deductions.push({ lot, deductQty, lotValue });
    totalDeducted += deductQty;
    totalValue += lotValue;
    remaining -= deductQty;
  }

  return { deductions, totalDeducted, totalValue, remaining };
}

// Calculate WAC (Weighted Average Cost) from lots
export function calculateWAC(lots: InventoryLot[]): number {
  const activeLots = lots.filter(
    (l) => l.remaining_qty > 0 && l.unit_price != null
  );
  if (activeLots.length === 0) return 0;

  const totalValue = activeLots.reduce(
    (sum, l) => sum + l.remaining_qty * (l.unit_price || 0),
    0
  );
  const totalQty = activeLots.reduce((sum, l) => sum + l.remaining_qty, 0);

  return totalQty > 0 ? totalValue / totalQty : 0;
}

// Calculate total stock for a branch+item
export function calculateTotalStock(lots: InventoryLot[]): number {
  return lots
    .filter((l) => l.remaining_qty > 0)
    .reduce((sum, l) => sum + l.remaining_qty, 0);
}

// Calculate total value for lots
export function calculateTotalValue(lots: InventoryLot[]): number {
  return lots
    .filter((l) => l.remaining_qty > 0)
    .reduce((sum, l) => sum + l.remaining_qty * (l.unit_price || 0), 0);
}
