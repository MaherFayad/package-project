"use client";

import { useEffect, useState } from "react";

export type SessionRole = "BUYER" | "VENDOR" | "ADMIN" | string;
/** null: signed out (also the server and first-paint value). */
type Me = { role: SessionRole } | null;

let cached: Promise<Me> | null = null;

function fetchMe(): Promise<Me> {
  if (!cached) {
    cached = fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d: { user: { role: SessionRole } | null }) => (d.user ? { role: d.user.role } : null))
      .catch(() => null);
  }
  return cached;
}

/**
 * Who is signed in, read on the client so the marketing layout uses no request API and store
 * pages can be prerendered (the header was the only thing reading cookies). One request per
 * page load, shared by every caller. Renders as signed out until it resolves.
 */
export function useSessionRole(): Me {
  const [me, setMe] = useState<Me>(null);
  useEffect(() => {
    let alive = true;
    fetchMe().then((m) => alive && setMe(m));
    return () => {
      alive = false;
    };
  }, []);
  return me;
}
