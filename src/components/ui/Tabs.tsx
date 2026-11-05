"use client";

import NextLink from "next/link";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useUi } from "./AppProvider";
import { CountBadge } from "./Badge";
import { cx } from "./utils";
import styles from "./Tabs.module.css";

export interface TabDescriptor {
  id: string;
  content: ReactNode;
  /** Short accessible name if `content` is not plain text. */
  accessibilityLabel?: string;
  badge?: ReactNode;
  /** Link tabs (navigation between pages) render as links inside a nav, not a tablist. */
  url?: string;
  /** Id of the panel this tab controls when panels are rendered outside <Tabs>. */
  panelID?: string;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabDescriptor[];
  selected: number;
  onSelect?: (index: number) => void;
  /** Stretch tabs to fill the width. */
  fitted?: boolean;
  /** Content of the selected panel (rendered in a tabpanel labelled by the selected tab). */
  children?: ReactNode;
  /** Name the tab list (e.g. "Order views"). */
  accessibilityLabel?: string;
  /** "manual" = arrows only move focus, Enter/Space selects. Default "automatic". */
  activation?: "automatic" | "manual";
}

/**
 * WAI-ARIA tabs. Arrow keys follow the reading direction (ArrowRight moves to the previous
 * tab in RTL), Home/End jump, roving tabindex keeps one tab stop. Overflowing tabs scroll
 * inside the bar so the page never scrolls sideways.
 */
export function Tabs({ tabs, selected, onSelect, fitted, children, accessibilityLabel, activation = "automatic" }: TabsProps) {
  const { dir } = useUi();
  const base = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const tabId = (i: number) => `${base}-tab-${tabs[i]?.id ?? i}`;
  const panelId = (i: number) => tabs[i]?.panelID ?? `${base}-panel-${tabs[i]?.id ?? i}`;
  const isLinks = tabs.every((t) => t.url);

  function focusTab(i: number) {
    const el = listRef.current?.querySelectorAll<HTMLElement>("[role='tab']")[i];
    el?.focus();
    el?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const enabled = tabs.map((t, i) => (t.disabled ? -1 : i)).filter((i) => i >= 0);
    if (!enabled.length) return;
    const current = tabs.findIndex((_, i) => document.activeElement?.id === tabId(i));
    const pos = Math.max(0, enabled.indexOf(current));
    const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const backward = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    let next: number | undefined;
    if (e.key === forward) next = enabled[(pos + 1) % enabled.length];
    else if (e.key === backward) next = enabled[(pos - 1 + enabled.length) % enabled.length];
    else if (e.key === "Home") next = enabled[0];
    else if (e.key === "End") next = enabled[enabled.length - 1];
    else if ((e.key === "Enter" || e.key === " ") && activation === "manual" && current >= 0) {
      e.preventDefault();
      onSelect?.(current);
      return;
    }
    if (next === undefined) return;
    e.preventDefault();
    focusTab(next);
    if (activation === "automatic") onSelect?.(next);
  }

  if (isLinks) {
    return (
      <nav aria-label={accessibilityLabel} className={styles.Wrapper}>
        <ul className={cx(styles.List, fitted && styles.fitted)}>
          {tabs.map((t, i) => (
            <li key={t.id} className={styles.Item}>
              <NextLink href={t.url!} className={cx(styles.Tab, i === selected && styles.selected)} aria-current={i === selected ? "page" : undefined}>
                <span>{t.content}</span>
                {t.badge !== undefined ? <CountBadge>{t.badge}</CountBadge> : null}
              </NextLink>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <div className={styles.Root}>
      <div className={styles.Wrapper}>
        <div ref={listRef} role="tablist" aria-label={accessibilityLabel} className={cx(styles.List, fitted && styles.fitted)} onKeyDown={onKeyDown}>
          {tabs.map((t, i) => {
            const isSel = i === selected;
            return (
              <button
                key={t.id}
                id={tabId(i)}
                type="button"
                role="tab"
                aria-selected={isSel}
                aria-controls={panelId(i)}
                aria-label={t.accessibilityLabel}
                tabIndex={isSel ? 0 : -1}
                disabled={t.disabled}
                className={cx(styles.Tab, isSel && styles.selected)}
                onClick={() => onSelect?.(i)}
              >
                <span>{t.content}</span>
                {t.badge !== undefined ? <CountBadge>{t.badge}</CountBadge> : null}
              </button>
            );
          })}
        </div>
      </div>
      {children !== undefined ? (
        <div role="tabpanel" id={panelId(selected)} aria-labelledby={tabId(selected)} tabIndex={0} className={styles.Panel}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
