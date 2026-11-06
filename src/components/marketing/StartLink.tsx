"use client";

import Link from "next/link";
import { useSessionRole } from "./useSessionRole";

/**
 * Header design CTA. Visitors see the promise ("Start designing free"); signed-in people get the
 * plain task label ("New design"), so account, orders and invoices carry no sales pitch (R4-CR-09).
 */
export function StartLink({ href, label, signedInLabel, className }: { href: string; label: string; signedInLabel: string; className?: string }) {
  const me = useSessionRole();
  return (
    <Link href={href} className={className}>
      {me ? signedInLabel : label}
    </Link>
  );
}
