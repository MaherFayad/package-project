"use client";

import { ArrowLeft, ChevronRight, Ellipsis } from "lucide-react";
import NextLink from "next/link";
import { useState, type ReactNode } from "react";
import { ActionList } from "./ActionList";
import { useUi } from "./AppProvider";
import { Button } from "./Button";
import { Icon, renderIcon, type IconSource } from "./Icon";
import { Pagination, type PaginationProps } from "./Pagination";
import { Popover } from "./Popover";
import { cx } from "./utils";
import styles from "./Page.module.css";

export interface PageAction {
  content: ReactNode;
  url?: string;
  external?: boolean;
  onAction?: () => void;
  icon?: IconSource;
  disabled?: boolean;
  loading?: boolean;
  destructive?: boolean;
  accessibilityLabel?: string;
}

export interface PageActionGroup {
  title: ReactNode;
  actions: PageAction[];
}

export interface PageProps {
  title?: ReactNode;
  /** Badges after the title (status). */
  titleMetadata?: ReactNode;
  /** Secondary line under the title (date, source). */
  subtitle?: ReactNode;
  /** Small resource icon before the title, e.g. the Orders icon. */
  titleIcon?: IconSource;
  /** "‹ Orders" back link shown before the title. */
  backAction?: { content: string; url?: string; onAction?: () => void };
  primaryAction?: PageAction | ReactNode;
  secondaryActions?: PageAction[];
  /** Menus like "More actions ⌄" / "Print ⌄". */
  actionGroups?: PageActionGroup[];
  pagination?: PaginationProps;
  /** Index pages: full width with gutters. Detail pages: default 998px max. */
  fullWidth?: boolean;
  narrowWidth?: boolean;
  /** Hide the title visually (still the page's h1). */
  titleHidden?: boolean;
  children?: ReactNode;
}

function isDescriptor(x: unknown): x is PageAction {
  return typeof x === "object" && x !== null && "content" in (x as Record<string, unknown>) && !("$$typeof" in (x as Record<string, unknown>));
}

function ActionMenu({ group, compact }: { group: PageActionGroup; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      active={open}
      onClose={() => setOpen(false)}
      preferredAlignment="end"
      ariaHaspopup="menu"
      activator={
        <Button variant="tertiary" disclosure={compact ? undefined : open ? "up" : "down"} icon={compact ? Ellipsis : undefined} accessibilityLabel={compact ? String(group.title) : undefined} onClick={() => setOpen((o) => !o)}>
          {compact ? undefined : group.title}
        </Button>
      }
    >
      <ActionList
        actionRole="menuitem"
        onActionAnyItem={() => setOpen(false)}
        items={group.actions.map((a) => ({
          content: a.content,
          url: a.url,
          external: a.external,
          onAction: a.onAction,
          icon: a.icon,
          disabled: a.disabled,
          destructive: a.destructive,
        }))}
      />
    </Popover>
  );
}

/**
 * Page: header (back link · icon · title · badges / subtitle · actions · pager) then content.
 * Header actions are grey "tertiary" buttons + one dark primary, as in the admin reference.
 * On phones the secondary actions and groups collapse into one "⋯" menu.
 */
export function Page({
  title,
  titleMetadata,
  subtitle,
  titleIcon,
  backAction,
  primaryAction,
  secondaryActions = [],
  actionGroups = [],
  pagination,
  fullWidth,
  narrowWidth,
  titleHidden,
  children,
}: PageProps) {
  const { s } = useUi();
  const hasHeader = title || backAction || primaryAction || secondaryActions.length || actionGroups.length;
  const allSecondary: PageAction[] = [...secondaryActions, ...actionGroups.flatMap((g) => g.actions)];

  const primary = primaryAction ? (
    isDescriptor(primaryAction) ? (
      <Button
        variant="primary"
        tone={primaryAction.destructive ? "critical" : undefined}
        url={primaryAction.url}
        external={primaryAction.external}
        onClick={primaryAction.onAction}
        icon={primaryAction.icon}
        disabled={primaryAction.disabled}
        loading={primaryAction.loading}
        accessibilityLabel={primaryAction.accessibilityLabel}
      >
        {primaryAction.content}
      </Button>
    ) : (
      primaryAction
    )
  ) : null;

  return (
    <div className={cx(styles.Page, fullWidth && styles.fullWidth, narrowWidth && styles.narrowWidth)}>
      {hasHeader ? (
        <div className={cx(styles.Header, titleHidden && styles.headerTitleHidden)}>
          <div className={styles.TitleArea}>
            {backAction ? (
              <nav aria-label={s.breadcrumb} className={styles.Back}>
                {backAction.url ? (
                  <NextLink href={backAction.url} className={styles.BackLink} aria-label={`${s.back}: ${backAction.content}`}>
                    {titleIcon ? renderIcon(titleIcon, { tone: "base" }) : <Icon source={ArrowLeft} flipInRtl />}
                  </NextLink>
                ) : (
                  <button type="button" className={styles.BackLink} onClick={backAction.onAction} aria-label={`${s.back}: ${backAction.content}`}>
                    {titleIcon ? renderIcon(titleIcon, { tone: "base" }) : <Icon source={ArrowLeft} flipInRtl />}
                  </button>
                )}
                {titleIcon ? (
                  <span className={styles.Chevron} aria-hidden="true">
                    <Icon source={ChevronRight} size="small" tone="subdued" flipInRtl />
                  </span>
                ) : null}
              </nav>
            ) : titleIcon ? (
              <span className={styles.TitleIcon}>{renderIcon(titleIcon, { tone: "base" })}</span>
            ) : null}
            <div className={styles.TitleBlock}>
              <div className={styles.TitleRow}>
                <h1 className={cx(styles.Title, titleHidden && "visually-hidden")}>{title}</h1>
                {titleMetadata ? <div className={styles.TitleMetadata}>{titleMetadata}</div> : null}
              </div>
              {subtitle ? <p className={styles.Subtitle}>{subtitle}</p> : null}
            </div>
          </div>
          {primary || allSecondary.length || pagination ? (
            <div className={styles.Actions}>
              <div className={styles.SecondaryDesktop}>
                {secondaryActions.map((a, i) => (
                  <Button
                    key={i}
                    variant="tertiary"
                    url={a.url}
                    external={a.external}
                    onClick={a.onAction}
                    icon={a.icon}
                    disabled={a.disabled}
                    loading={a.loading}
                    tone={a.destructive ? "critical" : undefined}
                    accessibilityLabel={a.accessibilityLabel}
                  >
                    {a.content}
                  </Button>
                ))}
                {actionGroups.map((g, i) => (
                  <ActionMenu key={i} group={g} />
                ))}
              </div>
              {allSecondary.length ? (
                <div className={styles.SecondaryMobile}>
                  <ActionMenu group={{ title: s.moreActions, actions: allSecondary }} compact />
                </div>
              ) : null}
              {primary}
              {pagination ? <Pagination {...pagination} /> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={styles.Content}>{children}</div>
    </div>
  );
}
