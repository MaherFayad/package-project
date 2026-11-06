"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Boxes, ChevronDown, Menu, Milk, PackageOpen, Printer, Rotate3d, Store, X } from "lucide-react";
import styles from "./marketing.module.css";

export interface MenuEntry {
  href: string;
  title: string;
  body: string;
  icon: "boxes" | "cartons" | "bottles" | "designer" | "directory" | "join";
}
export interface NavModel {
  label: string;
  products: { label: string; items: MenuEntry[] };
  printers: { label: string; items: MenuEntry[] };
  links: { href: string; label: string }[];
  menuLabel: string;
  closeLabel: string;
  /** Rendered inside the mobile sheet (login, CTA, language). */
  sheetActions: ReactNode;
  homeHref: string;
  brand: ReactNode;
  brandLabel: string;
}

const ICONS = { boxes: Boxes, cartons: PackageOpen, bottles: Milk, designer: Rotate3d, directory: Printer, join: Store } as const;

/** Desktop dropdown menu: button + panel; Escape and outside click close it, focus returns. */
function DropMenu({ label, items, open, onToggle, onClose }: { label: string; items: MenuEntry[]; open: boolean; onToggle: () => void; onClose: () => void }) {
  const id = useId();
  const wrap = useRef<HTMLLIElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        btn.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  return (
    <li
      className={styles.navItem}
      ref={wrap}
      onBlur={(e) => {
        if (open && !wrap.current?.contains(e.relatedTarget as Node | null)) onClose();
      }}
    >
      <button ref={btn} type="button" className={styles.navTrigger} aria-expanded={open} aria-controls={id} onClick={onToggle}>
        {label}
        <ChevronDown size={16} aria-hidden />
      </button>
      {open ? (
        <div className={styles.menuPanel} id={id}>
          <ul className={styles.menuList}>
            {items.map((it) => {
              const I = ICONS[it.icon];
              return (
                <li key={it.href}>
                  <Link href={it.href} className={styles.menuLink} onClick={onClose}>
                    <span className={styles.menuIcon} aria-hidden="true">
                      <I size={20} />
                    </span>
                    <span className={styles.menuText}>
                      <span className={styles.menuTitle}>{it.title}</span>
                      <span className={styles.menuBody}>{it.body}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Marketing header behaviour: desktop dropdowns, the full-screen mobile menu (focus kept inside,
 * Escape closes, body scroll locked) and the hairline under the bar once the page scrolls.
 */
export function HeaderNav({ model, children }: { model: NavModel; children: ReactNode }) {
  const [menu, setMenu] = useState<"products" | "printers" | null>(null);
  const [sheet, setSheet] = useState(false);
  const pathname = usePathname();
  const header = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const openBtn = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    setMenu(null);
    setSheet(false);
  }, [pathname]);

  useEffect(() => {
    const el = header.current;
    if (!el) return;
    const on = () => el.setAttribute("data-scrolled", window.scrollY > 4 ? "true" : "false");
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    if (!sheet) return;
    const root = document.documentElement;
    const opener = openBtn.current;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    const first = sheetRef.current?.querySelector<HTMLElement>("button, a");
    first?.focus();
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

  const isCurrent = (href: string) => {
    const path = href.split("#")[0];
    return !!pathname && path.length > 3 && (pathname === path || pathname.startsWith(`${path}/`));
  };

  return (
    <header className={styles.header} ref={header} data-scrolled="false">
      <div className={`${styles.container} ${styles.headerInner}`}>
        <Link href={model.homeHref} className={styles.brand} aria-label={model.brandLabel}>
          {model.brand}
        </Link>
        <nav aria-label={model.label} className={styles.navDesktop}>
          <ul className={styles.navList}>
            <DropMenu label={model.products.label} items={model.products.items} open={menu === "products"} onToggle={() => setMenu((m) => (m === "products" ? null : "products"))} onClose={close} />
            <DropMenu label={model.printers.label} items={model.printers.items} open={menu === "printers"} onToggle={() => setMenu((m) => (m === "printers" ? null : "printers"))} onClose={close} />
            {model.links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={styles.navLink} aria-current={isCurrent(l.href) ? "page" : undefined}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.headerActions}>
          {children}
          <button ref={openBtn} type="button" className={styles.menuButton} aria-expanded={sheet} aria-label={model.menuLabel} onClick={() => setSheet(true)}>
            <Menu size={24} aria-hidden />
          </button>
        </div>
      </div>
      {/* Portalled to the .site wrapper: the sticky header's backdrop-filter makes it the
          containing block for fixed descendants, which clipped the sheet to the 64px bar.
          .site still provides the --mk-* tokens. */}
      {sheet && header.current
        ? createPortal(
            <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={model.menuLabel} ref={sheetRef}>
              <div className={styles.sheetHead}>
                <Link href={model.homeHref} className={styles.brand} aria-label={model.brandLabel} onClick={() => setSheet(false)}>
                  {model.brand}
                </Link>
                <button type="button" className={styles.menuButton} aria-label={model.closeLabel} onClick={() => setSheet(false)}>
                  <X size={24} aria-hidden />
                </button>
              </div>
              <nav className={styles.sheetBody} aria-label={model.label}>
                {[model.products, model.printers].map((g) => (
                  <div key={g.label} className={styles.sheetGroup}>
                    <h2 className={styles.sheetGroupTitle}>{g.label}</h2>
                    {g.items.map((it) => (
                      <Link key={it.href} href={it.href} className={styles.sheetLink} onClick={() => setSheet(false)}>
                        {it.title}
                      </Link>
                    ))}
                  </div>
                ))}
                <div className={styles.sheetGroup}>
                  {model.links.map((l) => (
                    <Link key={l.href} href={l.href} className={styles.sheetLink} onClick={() => setSheet(false)}>
                      {l.label}
                    </Link>
                  ))}
                </div>
                <div className={styles.sheetActions}>{model.sheetActions}</div>
              </nav>
            </div>,
            header.current.parentElement ?? document.body,
          )
        : null}
    </header>
  );
}
