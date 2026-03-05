"use client";

import { create } from "zustand";
import type { InventoryLot, TransactionWithRelations } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

interface InventoryState {
  lots: InventoryLot[];
  transactions: TransactionWithRelations[];
  loading: boolean;
  fetchInventory: (branchId?: string) => Promise<void>;
  fetchTransactions: (limit?: number) => Promise<void>;
  getLotsByBranchItem: (branchId: string, itemId: string) => InventoryLot[];
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  lots: [],
  transactions: [],
  loading: true,

  fetchInventory: async (branchId) => {
    try {
      set({ loading: true });
      const supabase = createClient();
      let query = supabase
        .from("inventory")
        .select("*")
        .gt("remaining_qty", 0)
        .order("received_date", { ascending: true });

      if (branchId) {
        query = query.eq("branch_id", branchId);
      }

      const { data } = await query;
      set({ lots: (data as InventoryLot[]) || [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchTransactions: async (limit = 50) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "*, item:items(id, name), branch:branches!transactions_branch_id_fkey(id, name), target_branch:branches!transactions_target_branch_id_fkey(id, name), supplier:suppliers(id, name), performer:profiles(id, username)"
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("[fetchTransactions] Supabase error:", error.message);
        // Fallback: fetch without joins that might fail
        const { data: fallbackData } = await supabase
          .from("transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        set({ transactions: (fallbackData as TransactionWithRelations[]) || [] });
        return;
      }

      set({ transactions: (data as TransactionWithRelations[]) || [] });
    } catch (err) {
      console.error("[fetchTransactions] Error:", err);
    }
  },

  getLotsByBranchItem: (branchId, itemId) =>
    get().lots.filter(
      (l) =>
        l.branch_id === branchId &&
        l.item_id === itemId &&
        l.remaining_qty > 0
    ),
}));
