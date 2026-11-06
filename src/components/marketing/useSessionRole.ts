"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type SessionRole = "BUYER" | "VENDOR" | "ADMIN" | string;
/** null: signed out (also the server and first-paint value). `initial` feeds the avatar. */
type Me = { role: SessionRole; initial: string } | null;
type MeUser = { role: SessionRole; name?: string | null; phone?: string };

let cached: Promise<Me> | null = null;
/** Path the cached answer was fetched on: a navigation (e.g. sign-in -> account) asks again. */
let cachedFor: string | null = null;

function initialOf(u: MeUser): string {
  const n = (u.name ?? "").trim();
  return n ? n.charAt(0).toUpperCase() : "";
}

/** Forget the cached answer (after sign-out). */
export function resetSessionRole(): void {
  cached = null;
}

function fetchMe(path: string): Promise<Me> {
  if (!cached || cachedFor !== path) {
    cachedFor = path;
    cached = fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d: { user: MeUser | null }) => (d.user ? { role: d.user.role, initial: initialOf(d.user) } : null))
      .catch(() => null);
  }
  return cached;
}

/**
 * Who is signed in, read on the client so the marketing layout uses no request API and store
 * pages can be prerendered (the header was the only thing reading cookies). One request per
 * page (path), shared by every caller, so signing in or out and then navigating updates the
 * header. Renders as signed out until the first answer resolves.
 */
export function useSessionRole(): Me {
  const [me, setMe] = useState<Me>(null);
  const path = usePathname() ?? "";
  useEffect(() => {
    let alive = true;
    fetchMe(path).then((m) => alive && setMe(m));
    return () => {
      alive = false;
    };
  }, [path]);
  return me;
}
