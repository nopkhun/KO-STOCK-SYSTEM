"use client";

import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  quickActionOpen: boolean;
  activeTab: string;
  setSidebarOpen: (open: boolean) => void;
  setQuickActionOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  quickActionOpen: false,
  activeTab: "dashboard",

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setQuickActionOpen: (open) => set({ quickActionOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
