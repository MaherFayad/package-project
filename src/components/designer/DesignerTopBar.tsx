import Link from "next/link";
import { Suspense } from "react";
import { UserRound } from "lucide-react";
import type { Locale } from "@/types";
import { getT } from "@/i18n";
import { getSession } from "@/lib/auth/session";
import { ElbaWordmark } from "@/components/ui/Frame";
import { TopBarLanguage, TopBarSignIn } from "./TopBarLanguage";
import styles from "./designer.module.css";

/** Near-black 56 px bar (Polaris frame style) for the full-screen designer. */
export async function DesignerTopBar({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const session = await getSession();
  return (
    <header className={styles.topBar}>
      <Link href={`/${locale}`} className={styles.topBarBrand}>
        <ElbaWordmark />
        {/* Visible wordmark leads the name (WCAG 2.5.3), "Home" follows for context. */}
        <span className="visually-hidden">{t("nav.home")}</span>
      </Link>
      <span className={styles.topBarTitle}>{t("designer.topBar")}</span>
      <span className={styles.topBarSpacer} />
      <Suspense fallback={null}>
        <TopBarLanguage />
      </Suspense>
      {session ? (
        <Link href={`/${locale}/orders`} className={styles.topBarLink}>
          <UserRound aria-hidden size={16} />
          <span className={styles.collapseText}>{session.user.name || t("nav.account")}</span>
        </Link>
      ) : (
        // Client island: the link carries the live editor URL (R4-02). The fallback is the same
        // link to the start page, so the server HTML never lacks it.
        <Suspense
          fallback={
            <Link href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/design`)}`} className={styles.topBarLink}>
              {t("nav.signIn")}
            </Link>
          }
        >
          <TopBarSignIn />
        </Suspense>
      )}
    </header>
  );
}
