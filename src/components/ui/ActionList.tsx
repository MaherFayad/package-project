"use client";

import NextLink from "next/link";
import { useId, type KeyboardEvent, type ReactNode } from "react";
import { useUi } from "./AppProvider";
import { renderIcon, type IconSource } from "./Icon";
import { cx } from "./utils";
import styles from "./ActionList.module.css";

export interface ActionListItem {
  content: ReactNode;
  helpText?: ReactNode;
  icon?: IconSource;
  prefix?: ReactNode;
  suffix?: ReactNode;
  url?: string;
  external?: boolean;
  onAction?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  active?: boolean;
  id?: string;
}

export interface ActionListSection {
  title?: ReactNode;
  items: ActionListItem[];
}

export interface ActionListProps {
  items?: ActionListItem[];
  sections?: ActionListSection[];
  /** "menuitem" gives role=menu semantics (use inside a Popover opened by a menu button). */
  actionRole?: "menuitem" | "option";
  /** Called after any item fires (use it to close the parent popover). */
  onActionAnyItem?: () => void;
  ariaLabel?: string;
}

/** Vertical list of actions: 13px items, 28px tall, grey hover, optional icons and sections.
 *  Arrow keys move between items; Home/End jump. */
export function ActionList({ items, sections, actionRole, onActionAnyItem, ariaLabel }: ActionListProps) {
  const all: ActionListSection[] = sections ?? [{ items: items ?? [] }];
  const isMenu = actionRole === "menuitem";
  const { s } = useUi();
  const baseId = useId();

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const nodes = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-action-item]:not([aria-disabled='true'])"));
    if (!nodes.length) return;
    e.preventDefault();
    const i = nodes.indexOf(document.activeElement as HTMLElement);
    let n = 0;
    if (e.key === "ArrowDown") n = i < 0 ? 0 : (i + 1) % nodes.length;
    if (e.key === "ArrowUp") n = i <= 0 ? nodes.length - 1 : i - 1;
    if (e.key === "End") n = nodes.length - 1;
    nodes[n]?.focus();
  }

  return (
    <div className={styles.ActionList} onKeyDown={onKeyDown} role={isMenu ? "menu" : undefined} aria-label={ariaLabel}>
      {all.map((section, si) => (
        <div
          key={si}
          className={cx(styles.Section, si > 0 && styles.withDivider)}
          role={isMenu ? "group" : undefined}
          aria-labelledby={isMenu && section.title ? `${baseId}-s${si}` : undefined}
        >
          {section.title ? (
            <p id={`${baseId}-s${si}`} className={styles.SectionTitle}>
              {section.title}
            </p>
          ) : null}
          <ul className={styles.List} role={isMenu ? "none" : undefined}>
            {section.items.map((item, ii) => {
              const cls = cx(styles.Item, item.destructive && styles.destructive, item.active && styles.active, item.disabled && styles.disabled);
              const inner = (
                <>
                  {item.prefix ? <span className={styles.Prefix}>{item.prefix}</span> : item.icon ? <span className={styles.Prefix}>{renderIcon(item.icon)}</span> : null}
                  <span className={styles.Text}>
                    <span>{item.content}</span>
                    {item.helpText ? <span className={styles.HelpText}>{item.helpText}</span> : null}
                  </span>
                  {item.suffix ? <span className={styles.Suffix}>{item.suffix}</span> : null}
                </>
              );
              const fire = () => {
                if (item.disabled) return;
                item.onAction?.();
                onActionAnyItem?.();
              };
              const common = {
                id: item.id,
                className: cls,
                role: actionRole,
                "data-action-item": "",
                "aria-disabled": item.disabled || undefined,
                "aria-current": item.active && !isMenu ? ("true" as const) : undefined,
                // APG menu: one Tab stop for the whole menu, arrows move between items.
                tabIndex: isMenu ? -1 : undefined,
              };
              return (
                <li key={ii} role={isMenu ? "none" : undefined}>
                  {item.url && !item.disabled ? (
                    item.external ? (
                      <a {...common} href={item.url} target="_blank" rel="noopener noreferrer" onClick={fire}>
                        {inner}
                        <span className="visually-hidden"> {s.opensInNewTab}</span>
                      </a>
                    ) : (
                      <NextLink {...common} href={item.url} onClick={fire}>
                        {inner}
                      </NextLink>
                    )
                  ) : (
                    <button {...common} type="button" disabled={item.disabled} onClick={fire}>
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
