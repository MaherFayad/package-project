import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/redirect";
import { getT, toLocale } from "@/i18n";
import { LoginClient } from "./LoginClient";
import { Sheet } from "@/components/marketing/kit/Sheet";
import { Glow } from "@/components/marketing/kit/Glow";
import { Display, Lead } from "@/components/marketing/kit/Display";
import rs from "@/components/marketing/restyle/restyle.module.css";
import au from "@/components/marketing/restyle/auth.module.css";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  return {
    title: getT(locale)("nav.signIn"),
    robots: { index: false, follow: false },
    alternates: { languages: { ar: "/ar/login", en: "/en/login" } },
  };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const locale = toLocale((await params).locale);
  const raw = (await searchParams).next;
  const requested = Array.isArray(raw) ? raw[0] : raw;
  const next = safeNextPath(requested, locale);
  // No usable ?next=: land each role on its own home after sign-in (see LoginClient).
  const explicit = next !== `/${locale}` || requested === `/${locale}`;
  if (await getSession()) redirect(next);
  const t = getT(locale);
  return (
    <div className={rs.page}>
      <Sheet tone="dark" hero className={`${au.auth} ${rs.clip}`} aria-labelledby="login-title">
        <Glow color="violet" x="85%" y="0%" size="70vmax" />
        <Glow color="green" x="5%" y="110%" size="45vmax" />
        <div className={au.authGrid}>
          <div>
            <span className={au.badge} aria-hidden="true">
              <LockKeyhole size={20} />
            </span>
            <Display as="h1" size="64" id="login-title" className="m-enter-lcp">
              {t("auth.title")}
            </Display>
            <Lead>{t("auth.subtitle")}</Lead>
          </div>
          <section className={au.authCard} aria-labelledby="login-title">
            <LoginClient next={next} explicit={explicit} />
          </section>
        </div>
      </Sheet>
    </div>
  );
}
