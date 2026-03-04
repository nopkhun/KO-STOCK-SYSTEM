"use client";

import { create } from "zustand";
import type { Branch, Unit, Category, Supplier, Item, ItemWithRelations } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

interface MasterDataState {
  branches: Branch[];
  units: Unit[];
  categories: Category[];
  suppliers: Supplier[];
  items: ItemWithRelations[];
  loading: boolean;
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string | null) => void;
  fetchAll: () => Promise<void>;
  getItemById: (id: string) => ItemWithRelations | undefined;
  getBranchById: (id: string) => Branch | undefined;
}

export const useMasterDataStore = create<MasterDataState>((set, get) => ({
  branches: [],
  units: [],
  categories: [],
  suppliers: [],
  items: [],
  loading: true,
  selectedBranchId: null,

  setSelectedBranchId: (id) => set({ selectedBranchId: id }),

  fetchAll: async () => {
    try {
      set({ loading: true });
      const supabase = createClient();

      const [branchesRes, unitsRes, categoriesRes, suppliersRes, itemsRes] =
        await Promise.all([
          supabase.from("branches").select("*").order("name"),
          supabase.from("units").select("*").order("name"),
          supabase.from("categories").select("*").order("name"),
          supabase.from("suppliers").select("*").order("name"),
          supabase
            .from("items")
            .select("*, unit:units(*), category:categories(*)")
            .order("name"),
        ]);

      set({
        branches: (branchesRes.data as Branch[]) || [],
        units: (unitsRes.data as Unit[]) || [],
        categories: (categoriesRes.data as Category[]) || [],
        suppliers: (suppliersRes.data as Supplier[]) || [],
        items: (itemsRes.data as ItemWithRelations[]) || [],
        loading: false,
        selectedBranchId:
          get().selectedBranchId ||
          (branchesRes.data && branchesRes.data.length > 0
            ? branchesRes.data[0].id
            : null),
      });
    } catch {
      set({ loading: false });
    }
  },

  getItemById: (id) => get().items.find((item) => item.id === id),
  getBranchById: (id) => get().branches.find((b) => b.id === id),
}));
