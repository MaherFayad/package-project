"use client";

import { ArrowUpDown, ListFilter, Search, X } from "lucide-react";
import NextLink from "next/link";
import { Children, createContext, useContext, useId, useState, type MouseEvent, type ReactNode } from "react";
import { ActionList } from "./ActionList";
import { useUi } from "./AppProvider";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { ChoiceList } from "./ChoiceList";
import { Icon } from "./Icon";
import { Popover, PopoverPane } from "./Popover";
import { fill } from "./strings";
import { Tabs, type TabDescriptor } from "./Tabs";
import { cx } from "./utils";
import styles from "./IndexTable.module.css";

/* ───────────────────────── IndexTable ───────────────────────── */

export interface IndexTableHeading {
  title: ReactNode;
  alignment?: "start" | "center" | "end";
  /** Hide visually (still read by screen readers). */
  hidden?: boolean;
}

export interface BulkAction {
  content: ReactNode;
  onAction?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface SelectionCtx {
  selectable: boolean;
  selected: Set<string>;
  toggle: (id: string, on: boolean) => void;
  resourceSingular: string;
  s: ReturnType<typeof useUi>["s"];
}
const IndexCtx = createContext<SelectionCtx | null>(null);

export interface IndexTableProps {
  resourceName: { singular: string; plural: string };
  headings: IndexTableHeading[];
  /** Ids of all rows on this page, in order (needed for "select all"). */
  rowIds?: string[];
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Buttons shown in place of the header row while rows are selected. */
  promotedBulkActions?: BulkAction[];
  /** Overflow bulk actions behind "⋯". */
  bulkActions?: BulkAction[];
  /** Search / views / filters bar (usually <IndexFilters/>). */
  toolbar?: ReactNode;
  /** Optional title row inside the card, e.g. "Orders" + an action button. */
  title?: ReactNode;
  titleAction?: ReactNode;
  emptyState?: ReactNode;
  loading?: boolean;
  /** Footer (pagination, "Learn more" link). */
  footer?: ReactNode;
  /** Visible caption for screen readers (falls back to resourceName.plural). */
  caption?: string;
  children?: ReactNode;
}

/**
 * Index table (orders, jobs, quotes): toolbar · optional title row · header row (12px semibold on
 * grey) · 13px rows with hover and dividers. Selecting rows swaps the header for "N selected"
 * plus bulk actions. Wide tables scroll inside the card, never the page.
 */
function IndexTableRoot({
  resourceName,
  headings,
  rowIds = [],
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  promotedBulkActions = [],
  bulkActions = [],
  toolbar,
  title,
  titleAction,
  emptyState,
  loading,
  footer,
  caption,
  children,
}: IndexTableProps) {
  const { s } = useUi();
  const selected = new Set(selectedIds);
  const count = selectedIds.length;
  const allSelected = rowIds.length > 0 && rowIds.every((id) => selected.has(id));
  const headerState: boolean | "indeterminate" = allSelected ? true : count > 0 ? "indeterminate" : false;
  const [moreOpen, setMoreOpen] = useState(false);

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onSelectionChange?.(rowIds.filter((r) => next.has(r)));
  };
  const toggleAll = (on: boolean) => onSelectionChange?.(on ? [...rowIds] : []);
  const isEmpty = rowIds.length === 0 && Children.count(children) === 0;

  return (
    <IndexCtx.Provider value={{ selectable, selected, toggle, resourceSingular: resourceName.singular, s }}>
      <div className={styles.IndexTable} aria-busy={loading || undefined}>
        {toolbar ? <div className={styles.Toolbar}>{toolbar}</div> : null}
        {title || titleAction ? (
          <div className={styles.TitleRow}>
            <h2 className={styles.Title}>{title}</h2>
            {titleAction}
          </div>
        ) : null}
        {isEmpty && emptyState ? (
          <div className={styles.Empty}>{emptyState}</div>
        ) : (
          <div className={styles.TableArea}>
            {selectable && count > 0 ? (
              <div className={styles.BulkBar}>
                <Checkbox label={s.selectAll} labelHidden checked={headerState} onChange={toggleAll} />
                <span className={styles.BulkCount} aria-live="polite">
                  {fill(s.selected, { count })}
                </span>
                <div className={styles.BulkActions}>
                  {promotedBulkActions.map((a, i) => (
                    <Button key={i} size="slim" onClick={a.onAction} disabled={a.disabled} tone={a.destructive ? "critical" : undefined}>
                      {a.content}
                    </Button>
                  ))}
                  {bulkActions.length ? (
                    <Popover
                      active={moreOpen}
                      onClose={() => setMoreOpen(false)}
                      preferredAlignment="end"
                      ariaHaspopup="menu"
                      activator={<Button size="slim" icon={<span aria-hidden="true">⋯</span>} accessibilityLabel={s.moreActions} onClick={() => setMoreOpen((o) => !o)} />}
                    >
                      <ActionList
                        actionRole="menuitem"
                        onActionAnyItem={() => setMoreOpen(false)}
                        items={bulkActions.map((a) => ({ content: a.content, onAction: a.onAction, destructive: a.destructive, disabled: a.disabled }))}
                      />
                    </Popover>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className={styles.Scroll}>
              <table className={styles.Table}>
                <caption className="visually-hidden">{caption ?? resourceName.plural}</caption>
                <thead>
                  <tr className={cx(styles.HeadRow, selectable && count > 0 && styles.headHidden)}>
                    {selectable ? (
                      <th scope="col" className={cx(styles.Th, styles.CheckCell)}>
                        <Checkbox label={s.selectAll} labelHidden checked={headerState} onChange={toggleAll} />
                      </th>
                    ) : null}
                    {headings.map((h, i) => (
                      <th key={i} scope="col" className={cx(styles.Th, h.alignment && styles[`align-${h.alignment}`])}>
                        {h.hidden ? <span className="visually-hidden">{h.title}</span> : h.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>{children}</tbody>
              </table>
            </div>
          </div>
        )}
        {footer ? <div className={styles.Footer}>{footer}</div> : null}
      </div>
    </IndexCtx.Provider>
  );
}

export interface IndexTableRowProps {
  id: string;
  children?: ReactNode;
  /** "subdued" = cancelled/refunded (strikethrough secondary text). */
  tone?: "subdued" | "critical" | "success" | "warning";
  strikethrough?: boolean;
  disabled?: boolean;
  /** Accessible name of the row's checkbox, e.g. "Select order ELB-26001". */
  selectionLabel?: string;
}

/** A table row. Clicking empty space in the row follows its <IndexTableRowLink> (pointer shortcut;
 *  keyboard users tab to the link itself). */
export function IndexTableRow({ id, children, tone, strikethrough, disabled, selectionLabel }: IndexTableRowProps) {
  const ctx = useContext(IndexCtx);
  const isSel = ctx?.selected.has(id) ?? false;
  const onClick = (e: MouseEvent<HTMLTableRowElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("a,button,input,select,textarea,label,[role='button']")) return;
    const link = e.currentTarget.querySelector<HTMLAnchorElement>("a[data-primary-link]");
    link?.click();
  };
  return (
    <tr
      className={cx(styles.Row, isSel && styles.selected, tone && styles[`tone-${tone}`], (strikethrough || tone === "subdued") && styles.strike, disabled && styles.rowDisabled)}
      aria-selected={ctx?.selectable ? isSel : undefined}
      onClick={onClick}
    >
      {ctx?.selectable ? (
        <td className={cx(styles.Td, styles.CheckCell)}>
          <Checkbox
            label={selectionLabel ?? `${ctx.s.selectRow} ${ctx.resourceSingular} ${id}`}
            labelHidden
            checked={isSel}
            disabled={disabled}
            onChange={(on) => ctx.toggle(id, on)}
          />
        </td>
      ) : null}
      {children}
    </tr>
  );
}

export function IndexTableCell({ children, alignment, flush, className, as = "td", numeric }: { children?: ReactNode; alignment?: "start" | "center" | "end"; flush?: boolean; className?: string; as?: "td" | "th"; numeric?: boolean }) {
  const Tag = as;
  return (
    <Tag scope={as === "th" ? "row" : undefined} className={cx(styles.Td, alignment && styles[`align-${alignment}`], flush && styles.flush, numeric && styles.numeric, className)}>
      {children}
    </Tag>
  );
}

/** The row's primary link (semibold); whole-row clicks follow it. */
export function IndexTableRowLink({ url, children }: { url: string; children?: ReactNode }) {
  return (
    <NextLink href={url} data-primary-link="" className={styles.RowLink}>
      {children}
    </NextLink>
  );
}

export const IndexTable = Object.assign(IndexTableRoot, { Row: IndexTableRow, Cell: IndexTableCell, RowLink: IndexTableRowLink });

/* ───────────────────────── IndexFilters ───────────────────────── */

export interface AppliedFilter {
  key: string;
  label: ReactNode;
  onRemove: () => void;
}

export interface IndexFiltersProps {
  views?: TabDescriptor[];
  selectedView?: number;
  onSelectView?: (index: number) => void;
  queryValue: string;
  onQueryChange: (value: string) => void;
  onQueryClear?: () => void;
  queryPlaceholder?: string;
  /** Filter controls rendered in a popover behind the filter button. */
  filters?: ReactNode;
  appliedFilters?: AppliedFilter[];
  sortOptions?: { label: string; value: string }[];
  sortSelected?: string;
  onSort?: (value: string) => void;
  sortLabel?: string;
  filterLabel?: string;
}

/** Toolbar row: view tabs · "Search and filter" field · filter + sort icon buttons; applied filters as removable pills. */
export function IndexFilters({
  views,
  selectedView = 0,
  onSelectView,
  queryValue,
  onQueryChange,
  onQueryClear,
  queryPlaceholder,
  filters,
  appliedFilters = [],
  sortOptions,
  sortSelected,
  onSort,
  sortLabel = "Sort",
  filterLabel = "Filter",
}: IndexFiltersProps) {
  const { s } = useUi();
  const id = useId();
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  return (
    <div className={styles.Filters}>
      <div className={styles.FiltersRow}>
        {views?.length ? (
          <div className={styles.Views}>
            <Tabs tabs={views} selected={selectedView} onSelect={onSelectView} />
          </div>
        ) : null}
        <div className={styles.Query} role="search">
          <label htmlFor={id} className="visually-hidden">
            {queryPlaceholder ?? s.searchAndFilter}
          </label>
          <span className={styles.QueryIcon}>
            <Icon source={Search} size="small" tone="subdued" />
          </span>
          <input
            id={id}
            type="search"
            className={styles.QueryInput}
            value={queryValue}
            placeholder={queryPlaceholder ?? s.searchAndFilter}
            onChange={(e) => onQueryChange(e.target.value)}
            autoComplete="off"
          />
          {queryValue ? (
            <button type="button" className={styles.QueryClear} aria-label={s.clear} onClick={() => (onQueryClear ? onQueryClear() : onQueryChange(""))}>
              <Icon source={X} size="small" />
            </button>
          ) : null}
        </div>
        <div className={styles.FilterButtons}>
          {filters ? (
            <Popover
              active={filterOpen}
              onClose={() => setFilterOpen(false)}
              preferredAlignment="end"
              ariaHaspopup="dialog"
              ariaLabel={filterLabel}
              activator={<Button size="slim" icon={ListFilter} accessibilityLabel={filterLabel} onClick={() => setFilterOpen((o) => !o)} />}
            >
              <PopoverPane>{filters}</PopoverPane>
            </Popover>
          ) : null}
          {sortOptions?.length ? (
            <Popover
              active={sortOpen}
              onClose={() => setSortOpen(false)}
              preferredAlignment="end"
              ariaHaspopup="dialog"
              ariaLabel={sortLabel}
              activator={<Button size="slim" icon={ArrowUpDown} accessibilityLabel={sortLabel} onClick={() => setSortOpen((o) => !o)} />}
            >
              <PopoverPane>
                <ChoiceList
                  title={sortLabel}
                  choices={sortOptions}
                  selected={sortSelected ? [sortSelected] : []}
                  onChange={(v) => {
                    if (v[0]) onSort?.(v[0]);
                  }}
                />
              </PopoverPane>
            </Popover>
          ) : null}
        </div>
      </div>
      {appliedFilters.length ? (
        <ul className={styles.Applied}>
          {appliedFilters.map((f) => (
            <li key={f.key} className={styles.Pill}>
              <span>{f.label}</span>
              <button type="button" className={styles.PillRemove} aria-label={`${s.clear}: ${typeof f.label === "string" ? f.label : f.key}`} onClick={f.onRemove}>
                <Icon source={X} size="small" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ───────────────────────── DataTable ───────────────────────── */

export interface DataTableProps {
  columnContentTypes: ("text" | "numeric")[];
  headings: ReactNode[];
  rows: ReactNode[][];
  totals?: ReactNode[];
  totalsName?: ReactNode;
  showTotalsInFooter?: boolean;
  footerContent?: ReactNode;
  caption: string;
  /** Hide the caption visually. Default true. */
  hideCaption?: boolean;
  /** Fixed first column (row headers) — the first cell of each row is a <th scope="row">. */
  rowHeaders?: boolean;
  increasedTableDensity?: boolean;
}

/** Static data table for reports (price tiers, payouts). Numeric columns align to the end and use tabular digits. */
export function DataTable({ columnContentTypes, headings, rows, totals, totalsName = "Totals", showTotalsInFooter, footerContent, caption, hideCaption = true, rowHeaders = true, increasedTableDensity }: DataTableProps) {
  const align = (i: number) => (columnContentTypes[i] === "numeric" ? styles.numeric : undefined);
  const totalsRow = totals ? (
    <tr className={styles.TotalsRow}>
      {totals.map((t, i) => (i === 0 ? <th key={i} scope="row" className={styles.Td}>{t ?? totalsName}</th> : <td key={i} className={cx(styles.Td, align(i))}>{t}</td>))}
    </tr>
  ) : null;
  return (
    <div className={styles.DataTable}>
      {/* Focusable, named scroll region so keyboard users can scroll wide tables (WCAG 2.1.1). */}
      <div className={styles.Scroll} tabIndex={0} role="region" aria-label={caption}>
        <table className={cx(styles.Table, increasedTableDensity && styles.dense)}>
          <caption className={hideCaption ? "visually-hidden" : styles.Caption}>{caption}</caption>
          <thead>
            <tr className={styles.HeadRow}>
              {headings.map((h, i) => (
                <th key={i} scope="col" className={cx(styles.Th, align(i))}>
                  {h}
                </th>
              ))}
            </tr>
            {totals && !showTotalsInFooter ? totalsRow : null}
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className={styles.Row}>
                {r.map((c, ci) =>
                  ci === 0 && rowHeaders ? (
                    <th key={ci} scope="row" className={cx(styles.Td, styles.RowHeader, align(ci))}>
                      {c}
                    </th>
                  ) : (
                    <td key={ci} className={cx(styles.Td, align(ci))}>
                      {c}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
          {totals && showTotalsInFooter ? <tfoot>{totalsRow}</tfoot> : null}
        </table>
      </div>
      {footerContent ? <div className={styles.Footer}>{footerContent}</div> : null}
    </div>
  );
}
