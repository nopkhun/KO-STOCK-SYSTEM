"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { useMasterDataStore } from "@/stores/master-data";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const fetchAll = useMasterDataStore((s) => s.fetchAll);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (user) {
      fetchAll();
    }
  }, [user, fetchAll]);

  return <ToastProvider>{children}</ToastProvider>;
}
