"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Layers,
  Menu,
  Milk,
  MonitorSmartphone,
  PackageOpen,
  PenTool,
  Printer,
  Receipt,
  Rotate3d,
  Sparkles,
  Store,
  Truck,
  LayoutGrid,
  HelpCircle,
  X,
} from "lucide-react";
import { useI18n } from "@/i18n/client";
import { useSessionRole } from "./useSessionRole";
import { buildNav } from "./navModel";
import styles from "./kit/chrome.module.css";

const ICONS = {
  boxes: Boxes,
  cartons: PackageOpen,
  bottles: Milk,
  styles: LayoutGrid,
  designer: Rotate3d,
  newDesign: PenTool,
  finishes: Sparkles,
  pricing: Receipt,
  track: Truck,
  cafes: Coffee,
  beauty: Layers,
  ecommerce: MonitorSmartphone,
  directory: Printer,
  join: Store,
  how: HelpCircle,
} as const;
export type MenuIcon = keyof typeof ICONS;

export interface MegaLink {
  href: string;
  label: string;
  icon: MenuIcon;
}
export interface MegaMenu {
  id: string;
  label: string;
  groups: { title: string; links: MegaLink[] }[];
  featured?: { eyebrow: string; title: string; body: string; href: string; image: string; latestTitle?: string; latest?: string[] };
  foot?: { href: string; label: string; body: string }[];
}
/** Server-rendered slots; the menus and links are built on the client from the dictionary (navModel.ts). */
export interface NavSlots {
  brand: ReactNode;
  /** Rendered at the foot of the mobile menu (log in, CTA, language). */
  sheetActions: ReactNode;
  /** Rendered next to the menu button on phones (the underlined CTA). */
  mobileActions?: ReactNode;
}

const OPEN_DELAY = 90;
const CLOSE_DELAY = 220;

function MegaPanel({ menu, id, open }: { menu: MegaMenu; id: string; open: boolean }) {
  return (
    <div className={styles.panel} id={id} data-open={open ? "true" : "false"}>
      <div className={styles.panelInner} style={menu.featured ? undefined : { gridTemplateColumns: "1fr" }}>
        <div className={styles.groups} style={{ ["--cols" as string]: Math.min(menu.groups.length, 3) }}>
          {menu.groups.map((g) => (
            <div key={g.title}>
              <p className={styles.groupTitle}>{g.title}</p>
              <ul className={styles.groupList}>
                {g.links.map((l) => {
                  const I = ICONS[l.icon];
                  return (
                    <li key={l.href + l.label}>
                      <Link href={l.href} className={styles.menuLink}>
                        <I size={20} strokeWidth={1.5} aria-hidden />
                        <span>{l.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        {menu.featured ? (
          <div className={styles.featured}>
            <p className={styles.groupTitle}>{menu.featured.eyebrow}</p>
            <Link href={menu.featured.href} className={styles.featuredCard}>
              <span className={styles.featuredMedia} aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={menu.featured.image} alt="" width={200} height={200} loading="lazy" decoding="async" />
              </span>
              <span className={styles.featuredTitle}>{menu.featured.title}</span>
              <span className={styles.featuredBody}>{menu.featured.body}</span>
            </Link>
            {menu.featured.latest?.length ? (
              <>
                <p className={styles.groupTitle} style={{ marginBlockStart: 16 }}>
                  {menu.featured.latestTitle}
                </p>
                <ul className={styles.latest}>
                  {menu.featured.latest.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {menu.foot?.length ? (
        <div className={styles.panelFoot}>
          <div className={styles.panelFootInner}>
            {menu.foot.map((f) => (
              <Link key={f.href} href={f.href} className={styles.footLink}>
                <span>{f.label}</span>
                <span>{f.body}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Marketing header behaviour (client): mega-menus that open on hover (with intent delays), on
 * keyboard focus and on click; Escape closes and returns focus; the bar turns solid once the
 * page scrolls or a menu opens. Phones: full-screen menu with drill-down levels (focus kept
 * inside, Escape closes, scroll locked). Everything renders in the server HTML: without JS the
 * links in the mobile list and the top-level links still work.
 */
export function HeaderNav({ slots, children }: { slots: NavSlots; children: ReactNode }) {
  const { locale, t } = useI18n();
  const model = { ...buildNav(locale, t), ...slots };
  const [open, setOpen] = useState<string | null>(null);
  // Panels mount after hydration: they are hidden until opened (and their links are in the phone
  // menu and the footer too), so the static HTML stays small for the LCP (about 10 KB less).
  const [panels, setPanels] = useState(false);
  useEffect(() => setPanels(true), []);
  const [sheet, setSheet] = useState(false);
  const [level, setLevel] = useState<string | null>(null);
  const pathname = usePathname();
  const me = useSessionRole();
  const header = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const openBtn = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseId = useId();
  const extra = model.signedInLinks;
  const links = me && extra ? [...model.links, extra.orders, ...(me.role === "VENDOR" ? [extra.vendor] : me.role === "ADMIN" ? [extra.admin] : [])] : model.links;

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const schedule = useCallback((next: string | null, delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), delay);
  }, []);

  useEffect(() => {
    setOpen(null);
    setSheet(false);
    setLevel(null);
  }, [pathname]);

  useEffect(() => {
    const el = header.current;
    if (!el) return;
    let raf = 0;
    const on = () => {
      raf = 0;
      el.setAttribute("data-scrolled", window.scrollY > 8 ? "true" : "false");
    };
    on();
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(on);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Escape and outside clicks close the desktop menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const btn = header.current?.querySelector<HTMLButtonElement>(`[data-menu-trigger="${open}"]`);
      setOpen(null);
      btn?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!header.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  useEffect(() => () => clear(), []);

  // Mobile menu: lock scroll, keep focus inside, Escape closes, focus returns to the opener.
  useEffect(() => {
    if (!sheet) return;
    const root = document.documentElement;
    const opener = openBtn.current;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    sheetRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSheet(false);
        return;
      }
      if (e.key !== "Tab" || !sheetRef.current) return;
      const f = Array.from(sheetRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, select"));
      if (!f.length) return;
      const a = f[0];
      const z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [sheet]);

  // Move focus to the first item when a drill-down level opens.
  useEffect(() => {
    if (sheet) sheetRef.current?.querySelector<HTMLElement>("[data-level] button, [data-level] a")?.focus();
  }, [level, sheet]);

  const isCurrent = (href: string) => {
    const path = href.split("#")[0];
    return !!pathname && path.length > 3 && (pathname === path || pathname.startsWith(`${path}/`));
  };
  const levelMenu = model.menus.find((m) => m.id === level) ?? null;

  return (
    <header
      className={styles.header}
      ref={header}
      data-scrolled="false"
      data-open={open ? "true" : "false"}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse" && open) schedule(null, CLOSE_DELAY);
      }}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") clear();
      }}
    >
      <div className={styles.bar}>
        <Link href={model.homeHref} className={styles.brand} aria-label={model.brandLabel}>
          {model.brand}
        </Link>
        <nav aria-label={model.label} className={styles.nav}>
          <ul className={styles.navList}>
            {model.menus.map((m) => {
              const id = `${baseId}-${m.id}`;
              const isOpen = open === m.id;
              return (
                <li
                  key={m.id}
                  className={styles.navItem}
                  data-open={isOpen ? "true" : undefined}
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") schedule(m.id, open ? 0 : OPEN_DELAY);
                  }}
                  onBlur={(e) => {
                    if (isOpen && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(null);
                  }}
                >
                  <button
                    type="button"
                    className={styles.navTrigger}
                    aria-expanded={isOpen}
                    aria-controls={panels ? id : undefined}
                    data-menu-trigger={m.id}
                    onClick={() => {
                      clear();
                      setOpen((o) => (o === m.id ? null : m.id));
                    }}
                    onFocus={(e) => {
                      // Keyboard focus opens the panel (reference behaviour); Tab then walks its links.
                      if (e.currentTarget.matches(":focus-visible") && open !== m.id) {
                        clear();
                        setOpen(m.id);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setOpen(m.id);
                        requestAnimationFrame(() => document.getElementById(id)?.querySelector<HTMLElement>("a")?.focus());
                      }
                    }}
                  >
                    {m.label}
                    <ChevronDown size={14} strokeWidth={2} aria-hidden />
                  </button>
                  {panels ? <MegaPanel menu={m} id={id} open={isOpen} /> : null}
                </li>
              );
            })}
            {model.links.map((l) => (
              <li key={l.href} onPointerEnter={(e) => e.pointerType === "mouse" && open && schedule(null, CLOSE_DELAY)}>
                <Link href={l.href} className={styles.navLink} aria-current={isCurrent(l.href) ? "page" : undefined}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.actions}>
          {children}
          {model.mobileActions}
          <button ref={openBtn} type="button" className={`${styles.menuButton} ${styles.mobileOnly}`} aria-expanded={sheet} aria-haspopup="dialog" aria-label={model.menuLabel} onClick={() => setSheet(true)}>
            <Menu size={22} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>
      <div className={styles.scrim} aria-hidden="true" onClick={() => setOpen(null)} />
      {sheet && header.current
        ? createPortal(
            <div className={styles.mobile} role="dialog" aria-modal="true" aria-label={model.menuLabel} ref={sheetRef}>
              <div className={styles.mobileHead}>
                <Link href={model.homeHref} className={styles.brand} aria-label={model.brandLabel} onClick={() => setSheet(false)}>
                  {model.brand}
                </Link>
                <button type="button" className={styles.menuButton} aria-label={model.closeLabel} onClick={() => setSheet(false)}>
                  <X size={22} strokeWidth={1.75} aria-hidden />
                </button>
              </div>
              <nav className={styles.mobileBody} aria-label={model.label}>
                {levelMenu ? (
                  <div className={styles.mobileLevel} data-level={levelMenu.id} key={levelMenu.id}>
                    <button type="button" className={styles.mobileBack} onClick={() => setLevel(null)}>
                      <ChevronLeft size={20} aria-hidden />
                      {model.backLabel}
                    </button>
                    <h2 className={styles.mobileRow} style={{ borderBlockEnd: 0, cursor: "default" }}>
                      {levelMenu.label}
                    </h2>
                    {levelMenu.groups.map((g) => (
                      <div key={g.title} className={styles.mobileGroup}>
                        <p className={styles.groupTitle}>{g.title}</p>
                        <ul className={styles.groupList}>
                          {g.links.map((l) => {
                            const I = ICONS[l.icon];
                            return (
                              <li key={l.href + l.label}>
                                <Link href={l.href} className={styles.menuLink} onClick={() => setSheet(false)}>
                                  <I size={20} strokeWidth={1.5} aria-hidden />
                                  <span>{l.label}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul className={`${styles.mobileList} ${styles.mobileLevel}`} data-level="root">
                    {model.menus.map((m) => (
                      <li key={m.id}>
                        <button type="button" className={styles.mobileRow} onClick={() => setLevel(m.id)}>
                          {m.label}
                          <ChevronRight size={22} strokeWidth={1.5} aria-hidden />
                        </button>
                      </li>
                    ))}
                    {links.map((l) => (
                      <li key={l.href}>
                        <Link href={l.href} className={styles.mobileRow} onClick={() => setSheet(false)} aria-current={isCurrent(l.href) ? "page" : undefined}>
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </nav>
              <div className={styles.mobileFoot}>{model.sheetActions}</div>
            </div>,
            header.current.parentElement ?? document.body,
          )
        : null}
    </header>
  );
}
