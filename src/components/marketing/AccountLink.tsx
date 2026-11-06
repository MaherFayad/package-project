"use client";

import Link from "next/link";
import { useSessionRole } from "./useSessionRole";

/** "Log in" for visitors, "My account" once /api/auth/me says the visitor is signed in. */
export function AccountLink({ login, account, className }: { login: { href: string; label: string }; account: { href: string; label: string }; className: string }) {
  const me = useSessionRole();
  const l = me ? account : login;
  return (
    <Link href={l.href} className={className}>
      {l.label}
    </Link>
  );
}
