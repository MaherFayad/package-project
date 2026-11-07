"use client";

import Link from "next/link";
import { useSessionRole } from "./useSessionRole";

/**
 * Header design CTA. Visitors see the promise ("Start designing free"); signed-in people get the
 * plain task label ("New design") and go straight to the designer, while visitors land on
 * /[locale]/start first (R6), so account, orders and invoices carry no sales pitch (R4-CR-09).
 */
export function StartLink({
  href,
  signedInHref = href,
  label,
  signedInLabel,
  className,
}: {
  href: string;
  signedInHref?: string;
  label: string;
  signedInLabel: string;
  className?: string;
}) {
  const me = useSessionRole();
  return (
    <Link href={me ? signedInHref : href} className={className}>
      {me ? signedInLabel : label}
    </Link>
  );
}
