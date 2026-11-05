import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getT, toLocale } from "@/i18n";
import { LoginClient } from "./LoginClient";

export const metadata: Metadata = { robots: { index: false } };

/** Only same-origin relative paths are allowed as ?next= targets. */
function safeNext(next: string | undefined, locale: string): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) return next;
  return `/${locale}`;
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const locale = toLocale((await params).locale);
  const next = safeNext((await searchParams).next, locale);
  if (await getSession()) redirect(next);
  const t = getT(locale);
  return (
    <div style={{ maxWidth: "28rem", margin: "0 auto", padding: "var(--p-space-800) var(--p-page-gutter)" }}>
      <div
        style={{
          background: "var(--p-color-bg-surface)",
          borderRadius: "var(--p-border-radius-300)",
          boxShadow: "var(--p-shadow-bevel-100)",
          padding: "var(--p-space-500) var(--p-space-400)",
          display: "grid",
          gap: "var(--p-space-400)",
        }}
      >
        <div style={{ display: "grid", gap: "var(--p-space-100)" }}>
          <h1 style={{ fontSize: "var(--p-font-size-500)", lineHeight: "var(--p-font-line-height-700)", fontWeight: "var(--p-font-weight-bold)" }}>
            {t("auth.title")}
          </h1>
          <p style={{ color: "var(--p-color-text-secondary)" }}>{t("auth.subtitle")}</p>
        </div>
        <LoginClient next={next} />
      </div>
    </div>
  );
}
