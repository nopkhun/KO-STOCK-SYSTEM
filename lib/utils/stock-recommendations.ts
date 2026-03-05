// Utility for calculating recommended stock levels from historical usage data

export interface RecommendedMinStock {
  value: number;
  avgDailyUsage: number;
  daysOfData: number;
  safetyDays: number;
}

/**
 * Calculate recommended minimum stock based on historical out-transactions.
 * Uses average daily usage x safety factor (days of buffer stock).
 *
 * @param outTransactions - Array of stock-out transactions with amount and created_at
 * @param safetyDays - Number of days of buffer stock to maintain (default: 5)
 * @returns RecommendedMinStock or null if no data available
 */
export function calculateRecommendedMinStock(
  outTransactions: Array<{ amount: number; created_at: string }>,
  safetyDays: number = 5
): RecommendedMinStock | null {
  if (outTransactions.length === 0) return null;

  // Find date range of transactions
  const dates = outTransactions.map((t) => new Date(t.created_at).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const daysOfData = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24));

  // Calculate total usage
  const totalUsage = outTransactions.reduce((sum, t) => sum + t.amount, 0);
  const avgDailyUsage = totalUsage / daysOfData;

  // Recommended = average daily usage x safety days, rounded up to 1 decimal
  const value = Math.ceil(avgDailyUsage * safetyDays * 10) / 10;

  return {
    value,
    avgDailyUsage: Math.round(avgDailyUsage * 100) / 100,
    daysOfData: Math.round(daysOfData),
    safetyDays,
  };
}

/**
 * Calculate recommended price based on recent purchase history.
 * Returns weighted average cost from inventory lots, or average from recent transactions.
 *
 * @param lots - Active inventory lots with remaining_qty and unit_price
 * @returns Recommended price or null
 */
export function calculateRecommendedPrice(
  lots: Array<{ remaining_qty: number; unit_price: number | null }>
): number | null {
  const activeLots = lots.filter(
    (l) => l.remaining_qty > 0 && l.unit_price != null && l.unit_price > 0
  );

  if (activeLots.length === 0) return null;

  const totalValue = activeLots.reduce(
    (sum, l) => sum + l.remaining_qty * (l.unit_price || 0),
    0
  );
  const totalQty = activeLots.reduce((sum, l) => sum + l.remaining_qty, 0);

  if (totalQty === 0) return null;

  return Math.round((totalValue / totalQty) * 100) / 100;
}
