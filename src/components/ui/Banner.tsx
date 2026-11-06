"use client";

import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { useId, type ReactNode } from "react";
import { useUi } from "./AppProvider";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { cx } from "./utils";
import styles from "./Banner.module.css";

export type BannerTone = "info" | "success" | "warning" | "critical";

export interface BannerAction {
  content: ReactNode;
  url?: string;
  onAction?: () => void;
  loading?: boolean;
}

export interface BannerProps {
  tone?: BannerTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: BannerAction;
  secondaryAction?: BannerAction;
  onDismiss?: () => void;
  /** Inside a Card: lighter, no outer shadow. */
  inCard?: boolean;
  /** Critical banners announce assertively; others politely. Set false for static page content. */
  announce?: boolean;
  id?: string;
}

const ICONS = { info: Info, success: CircleCheck, warning: TriangleAlert, critical: CircleAlert };

/** Banner: tinted surface, icon in a rounded square, optional title, actions and dismiss. */
export function Banner({ tone = "info", title, children, action, secondaryAction, onDismiss, inCard, announce = false, id }: BannerProps) {
  const { s } = useUi();
  const titleId = useId();
  const role = announce ? (tone === "critical" ? "alert" : "status") : undefined;
  return (
    <div
      id={id}
      className={cx(styles.Banner, styles[`tone-${tone}`], inCard && styles.inCard, !title && styles.noTitle)}
      role={role}
      // Naming is prohibited on a role-less <div> (ARIA 1.2, generic): only name live banners.
      aria-labelledby={title && role ? titleId : undefined}
    >
      <span className={styles.IconBox}>
        <Icon source={ICONS[tone]} />
      </span>
      <div className={styles.Body}>
        {title ? (
          <p id={titleId} className={styles.Title}>
            {title}
          </p>
        ) : null}
        {children ? <div className={styles.Content}>{children}</div> : null}
        {action || secondaryAction ? (
          <div className={styles.Actions}>
            {action ? (
              <Button size="slim" url={action.url} onClick={action.onAction} loading={action.loading}>
                {action.content}
              </Button>
            ) : null}
            {secondaryAction ? (
              <Button variant="plain" url={secondaryAction.url} onClick={secondaryAction.onAction}>
                {secondaryAction.content}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {onDismiss ? (
        <span className={styles.Dismiss}>
          <Button variant="tertiary" className={styles.DismissButton} size="slim" icon={X} accessibilityLabel={s.dismiss} onClick={onDismiss} />
        </span>
      ) : null}
    </div>
  );
}
