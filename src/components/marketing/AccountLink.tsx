"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { signOut } from "@/components/auth/useSession";
import { resetSessionRole, useSessionRole } from "./useSessionRole";
import styles from "./marketing.module.css";

type L = { href: string; label: string };

async function doSignOut(home: string) {
  try {
    await signOut();
  } finally {
    resetSessionRole();
    // Full navigation: every client cache (session, router payloads) starts clean.
    window.location.assign(home);
  }
}

/**
 * Account entry in the marketing header. Visitors get "Log in". Signed-in visitors get an
 * account menu (avatar + "My account" button: My account, Sign out) in the bar, and in the
 * mobile sheet (`variant="sheet"`) a "My account" pill plus a "Sign out" button.
 * Who is signed in comes from /api/auth/me on the client (see useSessionRole).
 */
export function AccountLink({
  login,
  account,
  signOutLabel,
  home,
  className,
  variant = "bar",
}: {
  login: L;
  account: L;
  signOutLabel: string;
  /** Where sign-out lands (the locale home). */
  home: string;
  className: string;
  variant?: "bar" | "sheet";
}) {
  const me = useSessionRole();
  if (!me) {
    return (
      <Link href={login.href} className={className}>
        {login.label}
      </Link>
    );
  }
  if (variant === "sheet") {
    return (
      <>
        <Link href={account.href} className={className}>
          {account.label}
        </Link>
        <button type="button" className={className} onClick={() => void doSignOut(home)}>
          {signOutLabel}
        </button>
      </>
    );
  }
  return <AccountMenu account={account} signOutLabel={signOutLabel} home={home} initial={me.initial} />;
}

/** Desktop account menu: disclosure button + small panel. Escape and outside click close it. */
function AccountMenu({ account, signOutLabel, home, initial }: { account: L; signOutLabel: string; home: string; initial: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrap}
      className={`${styles.accountMenu} ${styles.loginLink}`}
      onBlur={(e) => {
        if (open && !wrap.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button ref={btn} type="button" className={styles.navTrigger} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span className={styles.accountAvatar} aria-hidden="true">
          {initial || <span className={styles.accountAvatarDot} />}
        </span>
        {account.label}
        <ChevronDown size={16} aria-hidden />
      </button>
      {open ? (
        <div className={`${styles.menuPanel} ${styles.accountPanel}`} id={id}>
          <ul className={styles.menuList}>
            <li>
              <Link href={account.href} className={styles.accountItem} onClick={() => setOpen(false)}>
                {account.label}
              </Link>
            </li>
            <li>
              <button type="button" className={styles.accountItem} onClick={() => void doSignOut(home)}>
                {signOutLabel}
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
