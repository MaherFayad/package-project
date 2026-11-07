"use client";

import { MessageCircle, Phone } from "lucide-react";
import { useI18n } from "@/i18n/client";
import type { SupportContact } from "@/lib/support";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import styles from "./checkout.module.css";

/**
 * "Need help?" box on checkout and payment (simplicity audit SIM-04): WhatsApp and call buttons
 * when ELBA_SUPPORT_PHONE is set, otherwise a plain line that says how to reach the team.
 */
export function HelpBox({ support }: { support: SupportContact | null }) {
  const { t } = useI18n();
  return (
    <section className={styles.help} aria-labelledby="help-title">
      <Text as="h2" variant="headingSm" id="help-title">
        {t("buyer.easy.help.title")}
      </Text>
      <Text as="p" variant="bodySm" tone="subdued">
        {support ? t("buyer.easy.help.body") : t("buyer.easy.help.fallback")}
      </Text>
      {support ? (
        <div className={styles.helpActions}>
          <Button url={support.whatsapp} external icon={MessageCircle} size="large">
            {t("buyer.easy.help.whatsapp")}
          </Button>
          <Button url={support.tel} icon={Phone} size="large">
            <span>
              {t("buyer.easy.help.call")} <bdi dir="ltr">{support.display}</bdi>
            </span>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
