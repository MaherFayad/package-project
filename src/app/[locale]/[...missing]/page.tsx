import { notFound } from "next/navigation";

/**
 * Catch-all for unknown paths under /ar and /en (CR-04, X-03). Without it they fell through to
 * the global app/not-found.tsx (no chrome, no locale). Throwing here renders the sibling
 * not-found.tsx inside MarketingShell, in the page language, with a 404 status.
 * /api, /_next and files never reach it: they are not under [locale] (see middleware matcher).
 */
export default function MissingPage(): never {
  notFound();
}
