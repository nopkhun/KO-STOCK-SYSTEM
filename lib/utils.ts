import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Tailwind class merge utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format number with commas
export function formatNumber(num: number, decimals = 0): string {
  return num.toLocaleString("th-TH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Format currency (Thai Baht)
export function formatCurrency(num: number): string {
  return `${formatNumber(num, 2)} บาท`;
}

// Format date to Thai locale
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Format date + time
export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Format relative time (e.g., "5 นาทีที่แล้ว")
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "เมื่อสักครู่";
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  if (diffHour < 24) return `${diffHour} ชั่วโมงที่แล้ว`;
  if (diffDay < 7) return `${diffDay} วันที่แล้ว`;
  return formatDate(d);
}

// Transaction type labels in Thai
export function getTransactionTypeLabel(
  type: string
): { label: string; color: string } {
  switch (type) {
    case "in":
      return { label: "รับเข้า", color: "text-green-600" };
    case "out":
      return { label: "เบิกออก", color: "text-red-600" };
    case "transfer":
      return { label: "โอนย้าย", color: "text-blue-600" };
    case "adjust":
      return { label: "ปรับยอด", color: "text-orange-600" };
    default:
      return { label: type, color: "text-gray-600" };
  }
}

// Check if transaction is editable (within 1 hour)
export function isTransactionEditable(
  createdAt: string,
  performedBy: string,
  currentUserId: string,
  type: string
): boolean {
  if (type === "transfer" || type === "adjust") return false;
  if (performedBy !== currentUserId) return false;
  const created = new Date(createdAt);
  const now = new Date();
  return now.getTime() - created.getTime() <= 3600000; // 1 hour
}

// Debounce utility
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
