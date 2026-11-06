import type { Metadata } from "next";
import Link from "next/link";
import { BellOff } from "lucide-react";
import { getT, toLocale } from "@/i18n";
import { db } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/auth/unsubscribe";
import { UnsubscribeForm } from "./UnsubscribeForm";
import styles from "../login/login.module.css";
import own from "./unsubscribe.module.css";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ u?: string | string[]; t?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  // Personal links: never indexed, never sent on as a referrer.
  return { title: getT(locale)("unsubscribe.metaTitle"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/**
 * GET /{locale}/unsubscribe?u=<userId>&t=<hmac>: the opt-out link at the end of every marketing
 * message (src/lib/jobs/followUp.ts). Shows a confirmation; the button withdraws the consent.
 */
export default async function UnsubscribePage({ params, searchParams }: Props) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const sp = await searchParams;
  const u = typeof sp.u === "string" ? sp.u : null;
  const tok = typeof sp.t === "string" ? sp.t : null;
  const valid = verifyUnsubscribeToken(u, tok);
  const user = valid ? await db.user.findUnique({ where: { id: u! }, select: { marketingConsent: true } }) : null;
  const state: "form" | "already" | "invalid" = !valid || !user ? "invalid" : user.marketingConsent ? "form" : "already";

  return (
    <div className={styles.page}>
      {state === "form" ? (
        <UnsubscribeForm userId={u!} token={tok!} />
      ) : (
        <section className={styles.card} aria-labelledby="unsub-title">
          <header className={styles.head}>
            <span className={styles.badge} aria-hidden="true">
              <BellOff size={20} />
            </span>
            <h1 id="unsub-title" className={styles.title}>
              {state === "already" ? t("unsubscribe.alreadyTitle") : t("unsubscribe.invalidTitle")}
            </h1>
            <p className={styles.subtitle}>{state === "already" ? t("unsubscribe.alreadyBody") : t("unsubscribe.invalidBody")}</p>
          </header>
          <Link className={own.secondary} href={`/${locale}/account`}>
            {t("unsubscribe.account")}
          </Link>
        </section>
      )}
    </div>
  );
}
