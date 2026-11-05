import type { ReactNode } from "react";

/**
 * Vendor area root (owner: vendor portal). Pass-through: the two route groups bring their own
 * chrome and their own single <main id="main">:
 *   (portal)/  admin frame, role VENDOR required   -> /[locale]/vendor, /jobs, /profile, /rate-cards, /payouts
 *   apply/     store shell, any visitor            -> /[locale]/vendor/apply (onboarding)
 */
export default function VendorAreaLayout({ children }: { children: ReactNode }) {
  return children;
}
