"use client";

import { create } from "zustand";
import type { Profile, UserRole } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

interface AuthState {
  user: Profile | null;
  loading: boolean;
  setUser: (user: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  isRole: (role: UserRole) => boolean;
  isAdmin: () => boolean;
  isMaster: () => boolean;
  canManageUsers: () => boolean;
  fetchProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),

  isRole: (role) => get().user?.role === role,
  isAdmin: () => {
    const r = get().user?.role;
    return r === "admin" || r === "master";
  },
  isMaster: () => get().user?.role === "master",
  canManageUsers: () => {
    const r = get().user?.role;
    return r === "admin" || r === "master";
  },

  fetchProfile: async () => {
    try {
      set({ loading: true });
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        set({ user: null, loading: false });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      set({ user: profile as Profile | null, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  signOut: async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ user: null });
  },
}));
