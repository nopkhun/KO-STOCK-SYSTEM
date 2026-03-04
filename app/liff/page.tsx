"use client";

import { useRouter } from "next/navigation";
import {
  PackagePlus,
  PackageMinus,
  Search,
  ClipboardCheck,
} from "lucide-react";
import { useLiff } from "./layout";

interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const actions: QuickAction[] = [
  {
    label: "รับเข้าสต็อก",
    description: "บันทึกรับวัตถุดิบเข้า",
    href: "/liff/stock-in",
    icon: <PackagePlus className="h-8 w-8" />,
    color: "text-green-600",
    bgColor: "bg-green-50 border-green-200 hover:bg-green-100",
  },
  {
    label: "เบิกสต็อก",
    description: "บันทึกเบิกวัตถุดิบออก",
    href: "/liff/stock-out",
    icon: <PackageMinus className="h-8 w-8" />,
    color: "text-red-600",
    bgColor: "bg-red-50 border-red-200 hover:bg-red-100",
  },
  {
    label: "เช็คสต็อก",
    description: "ดูจำนวนสต็อกคงเหลือ",
    href: "/liff/check",
    icon: <Search className="h-8 w-8" />,
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200 hover:bg-blue-100",
  },
  {
    label: "ตรวจนับ",
    description: "ตรวจนับสต็อกจริง",
    href: "/liff/stocktake",
    icon: <ClipboardCheck className="h-8 w-8" />,
    color: "text-orange-600",
    bgColor: "bg-orange-50 border-orange-200 hover:bg-orange-100",
  },
];

export default function LiffHomePage() {
  const router = useRouter();
  const { profile } = useLiff();

  return (
    <div className="p-4 pb-8">
      {/* Greeting */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          {profile ? `สวัสดี ${profile.displayName}` : "สวัสดี"}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          เลือกสิ่งที่ต้องการทำ
        </p>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action.href}
            onClick={() => router.push(action.href)}
            className={`flex flex-col items-center justify-center p-5 rounded-xl border transition-colors ${action.bgColor}`}
          >
            <div className={action.color}>{action.icon}</div>
            <span className="mt-3 text-sm font-semibold text-gray-900">
              {action.label}
            </span>
            <span className="mt-1 text-xs text-gray-500 text-center">
              {action.description}
            </span>
          </button>
        ))}
      </div>

      {/* Profile info */}
      {profile && (
        <div className="mt-6 flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3">
          {profile.pictureUrl && (
            <img
              src={profile.pictureUrl}
              alt={profile.displayName}
              className="h-10 w-10 rounded-full"
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {profile.displayName}
            </p>
            {profile.statusMessage && (
              <p className="text-xs text-gray-500 truncate">
                {profile.statusMessage}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
