import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/redirect";
import { getT, toLocale } from "@/i18n";
import { LoginClient } from "./LoginClient";
import styles from "./login.module.css";

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
    <div className={styles.page}>
      <section className={styles.card} aria-labelledby="login-title">
        <header className={styles.head}>
          <span className={styles.badge} aria-hidden="true">
            <LockKeyhole size={20} />
          </span>
          <h1 id="login-title" className={styles.title}>
            {t("auth.title")}
          </h1>
          <p className={styles.subtitle}>{t("auth.subtitle")}</p>
        </header>
        <LoginClient next={next} explicit={explicit} />
      </section>
    </div>
  );
}
