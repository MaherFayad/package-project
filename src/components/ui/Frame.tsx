"use client";

import { CircleAlert, Menu, Search, X } from "lucide-react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ActionList, type ActionListSection } from "./ActionList";
import { useUi } from "./AppProvider";
import { Avatar } from "./Avatar";
import { CountBadge } from "./Badge";
import { Button } from "./Button";
import { Icon, renderIcon, type IconSource } from "./Icon";
import { Popover } from "./Popover";
import { cx, getFocusable } from "./utils";
import styles from "./Frame.module.css";

/* ───────────────────────── Frame ───────────────────────── */

interface FrameContextValue {
  hasNavigation: boolean;
  navOpen: boolean;
  toggleNav: () => void;
  closeNav: () => void;
  navId: string;
  toggleRef: React.RefObject<HTMLButtonElement | null>;
}

const FrameContext = createContext<FrameContextValue | null>(null);

export interface FrameProps {
  topBar?: ReactNode;
  navigation?: ReactNode;
  children?: ReactNode;
  /** Accessible name of the side navigation landmark. */
  navigationLabel?: string;
  /** Render the content area as a <div> when an outer layout already owns <main id="main">. */
  contentElement?: "main" | "div";
}

/**
 * Admin frame: near-black top bar, light-grey side navigation (off-canvas on phones), and
 * the #f1f1f1 canvas in a rounded sheet. Renders the page's single <main id="main">.
 * Side nav sits on the inline start (right in RTL).
 */
export function Frame({ topBar, navigation, children, navigationLabel, contentElement = "main" }: FrameProps) {
  const { s } = useUi();
  const navId = useId();
  const [navOpen, setNavOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const closeNav = useCallback(() => {
    setNavOpen(false);
  }, []);
  const toggleNav = useCallback(() => setNavOpen((o) => !o), []);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Focus into the drawer when it opens; back to the toggle when it closes.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (navOpen) {
      getFocusable(navRef.current)[0]?.focus();
    } else if (wasOpen.current) {
      toggleRef.current?.focus();
    }
    wasOpen.current = navOpen;
  }, [navOpen]);

  function onNavKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!navOpen) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      closeNav();
      return;
    }
    if (e.key === "Tab") {
      const nodes = getFocusable(navRef.current);
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }

  const ctx = useMemo<FrameContextValue>(
    () => ({ hasNavigation: Boolean(navigation), navOpen, toggleNav, closeNav, navId, toggleRef }),
    [navigation, navOpen, toggleNav, closeNav, navId],
  );

  return (
    <FrameContext.Provider value={ctx}>
      <div className={cx(styles.Frame, navigation ? styles.hasNav : undefined)}>
        {topBar ? <div className={styles.TopBarSlot}>{topBar}</div> : null}
        <div className={styles.Sheet}>
          {navigation ? (
            <>
              <div
                ref={navRef}
                id={navId}
                className={cx(styles.NavContainer, navOpen && styles.navOpen)}
                onKeyDown={onNavKeyDown}
                role={navOpen ? "dialog" : undefined}
                aria-modal={navOpen ? true : undefined}
                aria-label={navOpen ? (navigationLabel ?? s.mainNavigation) : undefined}
              >
                <div className={styles.NavCloseRow}>
                  <Button variant="tertiary" icon={X} accessibilityLabel={s.closeNavigation} onClick={closeNav} />
                </div>
                {navigation}
              </div>
              {navOpen ? <div className={styles.NavBackdrop} onClick={closeNav} aria-hidden="true" /> : null}
            </>
          ) : null}
          {contentElement === "main" ? (
            <main id="main" tabIndex={-1} className={styles.Main}>
              {children}
            </main>
          ) : (
            <div className={styles.Main}>{children}</div>
          )}
        </div>
      </div>
    </FrameContext.Provider>
  );
}

export function useFrame() {
  return useContext(FrameContext);
}

/* ───────────────────────── TopBar ───────────────────────── */

export interface ContextualSaveBarProps {
  message?: ReactNode;
  saveAction: { onAction?: () => void; loading?: boolean; disabled?: boolean; content?: ReactNode; submit?: boolean; form?: string };
  discardAction?: { onAction?: () => void; content?: ReactNode };
}

export interface UserMenuProps {
  name: string;
  detail?: ReactNode;
  initials?: string;
  avatarSource?: string;
  actions: ActionListSection[];
}

export interface TopBarProps {
  /** Our wordmark (defaults to <ElbaWordmark/>) linking home. */
  logo?: ReactNode;
  logoUrl?: string;
  /** Usually <TopBarSearchField/>. Replaced by the save bar while a form is dirty. */
  searchField?: ReactNode;
  /** Icon buttons (notifications, help) before the user menu. */
  secondaryMenu?: ReactNode;
  userMenu?: UserMenuProps;
  /** When set, the centred search is replaced by the dark "Unsaved changes" bar. */
  contextualSaveBar?: ContextualSaveBarProps | null;
}

/** 56px near-black bar: wordmark · centred search pill (or save bar) · icons · user. */
export function TopBar({ logo, logoUrl = "/", searchField, secondaryMenu, userMenu, contextualSaveBar }: TopBarProps) {
  const { s } = useUi();
  const frame = useFrame();
  return (
    <header className={styles.TopBar}>
      <div className={styles.TopBarStart}>
        {frame?.hasNavigation ? (
          <button
            ref={frame.toggleRef}
            type="button"
            className={cx(styles.TopBarIconButton, styles.NavToggle)}
            aria-label={s.openNavigation}
            aria-expanded={frame.navOpen}
            aria-controls={frame.navId}
            onClick={frame.toggleNav}
          >
            <Icon source={Menu} />
          </button>
        ) : null}
        <NextLink href={logoUrl} className={styles.LogoLink}>
          {logo ?? <ElbaWordmark />}
        </NextLink>
      </div>
      <div className={styles.TopBarCenter}>{contextualSaveBar ? <ContextualSaveBar {...contextualSaveBar} /> : searchField}</div>
      <div className={styles.TopBarEnd}>
        {secondaryMenu}
        {userMenu ? <UserMenu {...userMenu} /> : null}
      </div>
    </header>
  );
}

/** Square icon button styled for the dark top bar. */
export function TopBarIconButton({ icon, label, onClick, url, badge }: { icon: IconSource; label: string; onClick?: () => void; url?: string; badge?: number }) {
  const inner = (
    <>
      {renderIcon(icon)}
      {badge ? <span className={styles.Dot}>{badge > 9 ? "9+" : badge}</span> : null}
    </>
  );
  return url ? (
    <NextLink href={url} className={styles.TopBarIconButton} aria-label={label}>
      {inner}
    </NextLink>
  ) : (
    <button type="button" className={styles.TopBarIconButton} aria-label={label} onClick={onClick}>
      {inner}
    </button>
  );
}

export interface TopBarSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  /** Show the ⌘K / Ctrl K hint and bind the shortcut (default true). */
  shortcut?: boolean;
  /** Search results / recent searches dropdown content. */
  results?: ReactNode;
}

/** Dark search pill with magnifier and ⌘K hint; Ctrl/⌘+K focuses it from anywhere. */
export function TopBarSearchField({ value, onChange, onSubmit, placeholder, shortcut = true, results }: TopBarSearchFieldProps) {
  const { s } = useUi();
  const ref = useRef<HTMLInputElement>(null);
  const id = useId();
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    if (!shortcut) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);
  return (
    <form
      role="search"
      className={styles.Search}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(value);
      }}
    >
      <label htmlFor={id} className="visually-hidden">
        {placeholder ?? s.search}
      </label>
      <span className={styles.SearchIcon}>
        <Icon source={Search} size="small" />
      </span>
      <input
        ref={ref}
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? s.search}
        className={styles.SearchInput}
        autoComplete="off"
        aria-keyshortcuts={shortcut ? "Control+K Meta+K" : undefined}
      />
      {shortcut ? (
        <span className={styles.Kbd} aria-hidden="true">
          <kbd>{isMac ? "⌘" : "Ctrl"}</kbd>
          <kbd>K</kbd>
        </span>
      ) : null}
      {results ? <div className={styles.SearchResults}>{results}</div> : null}
    </form>
  );
}

function UserMenu({ name, detail, initials, avatarSource, actions }: UserMenuProps) {
  const { s } = useUi();
  const [open, setOpen] = useState(false);
  return (
    <Popover
      active={open}
      onClose={() => setOpen(false)}
      preferredAlignment="end"
      ariaHaspopup="menu"
      activator={
        // Name from content (no aria-label), so it always contains the visible text (WCAG 2.5.3 label in name).
        <button type="button" className={styles.UserButton} onClick={() => setOpen((o) => !o)}>
          <Avatar name={name} initials={initials} source={avatarSource} size="md" decorative />
          <span className={styles.UserName}>{name}</span>
          <span className="visually-hidden">{`, ${s.accountMenu}`}</span>
        </button>
      }
    >
      <div className={styles.UserHeader}>
        <span className={styles.UserHeaderName}>{name}</span>
        {detail ? <span className={styles.UserHeaderDetail}>{detail}</span> : null}
      </div>
      <ActionList actionRole="menuitem" sections={actions} onActionAnyItem={() => setOpen(false)} />
    </Popover>
  );
}

/** Dark pill: "Unsaved changes" · Discard · Save. Lives in the top bar while a form is dirty. */
export function ContextualSaveBar({ message, saveAction, discardAction }: ContextualSaveBarProps) {
  const { s } = useUi();
  return (
    <div className={styles.SaveBar} role="region" aria-label={typeof message === "string" ? message : s.unsavedChanges}>
      <span className={styles.SaveBarMessage}>
        <Icon source={CircleAlert} size="small" />
        <span role="status">{message ?? s.unsavedChanges}</span>
      </span>
      <span className={styles.SaveBarActions}>
        {discardAction ? (
          <button type="button" className={styles.SaveBarDiscard} onClick={discardAction.onAction}>
            {discardAction.content ?? s.discard}
          </button>
        ) : null}
        <button
          type={saveAction.submit ? "submit" : "button"}
          form={saveAction.form}
          className={styles.SaveBarSave}
          onClick={saveAction.onAction}
          disabled={saveAction.disabled || saveAction.loading}
          aria-busy={saveAction.loading || undefined}
        >
          {saveAction.content ?? s.save}
        </button>
      </span>
    </div>
  );
}

/** Elba wordmark: kraft-board square glyph + name. Our own mark (no third-party logos). */
export function ElbaWordmark({ tone = "inverse" }: { tone?: "inverse" | "base" }) {
  const { locale } = useUi();
  return (
    <span className={cx(styles.Wordmark, tone === "base" && styles.wordmarkBase)}>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
        <path d="M12 2.5 21 7v10l-9 4.5L3 17V7z" fill="var(--e-color-brand-kraft)" />
        <path d="M3 7l9 4.5L21 7M12 11.5V21.5" fill="none" stroke="var(--e-color-brand-kraft-strong)" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      <span>{locale === "ar" ? "علبة" : "Elba"}</span>
    </span>
  );
}

/* ───────────────────────── Navigation ───────────────────────── */

export interface NavigationItem {
  url: string;
  label: ReactNode;
  icon?: IconSource;
  badge?: ReactNode;
  /** Force selection state; otherwise computed from the current path (longest prefix wins). */
  selected?: boolean;
  /** Only select on an exact path match (e.g. the area home). */
  exactMatch?: boolean;
  /** Extra path prefixes that should select this item. */
  matchPaths?: string[];
  subNavigationItems?: { url: string; label: ReactNode; badge?: ReactNode; exactMatch?: boolean }[];
  disabled?: boolean;
  external?: boolean;
}

export interface NavigationSectionProps {
  items: NavigationItem[];
  title?: ReactNode;
  /** Pin to the bottom of the nav (Settings). */
  pinned?: boolean;
  separator?: boolean;
}

export interface NavigationProps {
  /** Current path; defaults to usePathname(). */
  location?: string;
  sections: NavigationSectionProps[];
  ariaLabel?: string;
  /** Optional header (store switcher, vendor name). */
  header?: ReactNode;
}

function matchScore(path: string, url: string, exact?: boolean): number {
  const clean = (u: string) => u.split(/[?#]/)[0]!.replace(/\/$/, "");
  const p = clean(path);
  const u = clean(url);
  if (p === u) return u.length + 1000;
  if (exact) return -1;
  return p.startsWith(u + "/") ? u.length : -1;
}

/** Light-grey side navigation: 16px icon + 13px semibold label, white pill for the active item,
 *  count badges at the inline end, sub-items under the active parent, pinned bottom section. */
export function Navigation({ location, sections, ariaLabel, header }: NavigationProps) {
  const { s } = useUi();
  const pathname = usePathname();
  const path = location ?? pathname ?? "";

  // Find the single best-matching item across all sections.
  let best: { si: number; ii: number; score: number } | null = null;
  sections.forEach((sec, si) =>
    sec.items.forEach((item, ii) => {
      const scores = [matchScore(path, item.url, item.exactMatch), ...(item.matchPaths ?? []).map((m) => matchScore(path, m)), ...(item.subNavigationItems ?? []).map((sub) => matchScore(path, sub.url, sub.exactMatch))];
      const score = Math.max(...scores);
      if (score >= 0 && (!best || score > best.score)) best = { si, ii, score };
    }),
  );
  const winner = best as { si: number; ii: number; score: number } | null;

  const top = sections.filter((x) => !x.pinned);
  const pinned = sections.filter((x) => x.pinned);

  const renderSection = (sec: NavigationSectionProps, si: number) => (
    <div key={si} className={cx(styles.NavSection, sec.separator && styles.navSeparator)}>
      {sec.title ? <p className={styles.NavSectionTitle}>{sec.title}</p> : null}
      <ul className={styles.NavList}>
        {sec.items.map((item, ii) => {
          const selected = item.selected ?? (winner?.si === si && winner?.ii === ii);
          const subSelectedIdx = selected
            ? (item.subNavigationItems ?? []).reduce<{ i: number; sc: number }>(
                (acc, sub, i) => {
                  const sc = matchScore(path, sub.url, sub.exactMatch);
                  return sc > acc.sc ? { i, sc } : acc;
                },
                { i: -1, sc: -1 },
              ).i
            : -1;
          const parentIsCurrent = selected && subSelectedIdx < 0;
          return (
            <li key={ii}>
              {item.disabled ? (
                <span className={cx(styles.NavItem, styles.navDisabled)} aria-disabled="true">
                  {item.icon ? <span className={styles.NavIcon}>{renderIcon(item.icon)}</span> : null}
                  <span className={styles.NavLabel}>{item.label}</span>
                </span>
              ) : (
                <NextLink
                  href={item.url}
                  className={cx(styles.NavItem, selected && styles.navSelected)}
                  aria-current={parentIsCurrent ? "page" : undefined}
                  target={item.external ? "_blank" : undefined}
                >
                  {item.icon ? <span className={styles.NavIcon}>{renderIcon(item.icon)}</span> : null}
                  <span className={styles.NavLabel}>{item.label}</span>
                  {item.badge !== undefined && item.badge !== null ? <CountBadge>{item.badge}</CountBadge> : null}
                </NextLink>
              )}
              {selected && item.subNavigationItems?.length ? (
                <ul className={styles.SubList}>
                  {item.subNavigationItems.map((sub, k) => (
                    <li key={k}>
                      <NextLink
                        href={sub.url}
                        className={cx(styles.SubItem, k === subSelectedIdx && styles.subSelected)}
                        aria-current={k === subSelectedIdx ? "page" : undefined}
                      >
                        <span className={styles.NavLabel}>{sub.label}</span>
                        {sub.badge !== undefined ? <CountBadge>{sub.badge}</CountBadge> : null}
                      </NextLink>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <nav className={styles.Navigation} aria-label={ariaLabel ?? s.mainNavigation}>
      {header ? <div className={styles.NavHeader}>{header}</div> : null}
      <div className={styles.NavScroll}>{top.map((sec) => renderSection(sec, sections.indexOf(sec)))}</div>
      {pinned.length ? <div className={styles.NavPinned}>{pinned.map((sec) => renderSection(sec, sections.indexOf(sec)))}</div> : null}
    </nav>
  );
}
