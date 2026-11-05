import Link from "next/link";
import { Suspense } from "react";
import { UserRound } from "lucide-react";
import type { Locale } from "@/types";
import { getT } from "@/i18n";
import { getSession } from "@/lib/auth/session";
import { ElbaWordmark } from "@/components/ui";
import { TopBarLanguage } from "./TopBarLanguage";
import styles from "./designer.module.css";

/** Near-black 56 px bar (Polaris frame style) for the full-screen designer. */
export async function DesignerTopBar({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const session = await getSession();
  return (
    <header className={styles.topBar}>
      <Link href={`/${locale}`} className={styles.topBarBrand} aria-label={t("nav.home")}>
        <ElbaWordmark />
      </Link>
      <span className={styles.topBarTitle}>{t("designer.title")}</span>
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
        <Link href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/design`)}`} className={styles.topBarLink}>
          {t("nav.signIn")}
        </Link>
      )}
    </header>
  );
}
