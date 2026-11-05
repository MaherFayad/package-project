"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale, Role } from "@/types";

export interface ClientSessionUser {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
  locale: Locale;
  vendorId: string | null;
  marketingConsent: boolean;
}

/** Client-side session probe via GET /api/auth/me. Prefer server getSession() where possible. */
export function useSession() {
  const [user, setUser] = useState<ClientSessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      const d = (await r.json()) as { user: ClientSessionUser | null };
      setUser(d.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { user, loading, refresh };
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
