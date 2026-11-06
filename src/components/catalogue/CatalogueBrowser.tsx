"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Locale } from "@/types";
import type { CatalogueCard } from "@/data/catalogue/types";
import type { TaxonomyNode } from "@/data/catalogue/taxonomy";
import { searchRanked } from "./rank";
import { byWedge } from "@/data/catalogue/order-mode";
import { formatNumber } from "@/lib/format";
import { COPY, fill } from "./copy";
import styles from "./catalogue.module.css";

type Scope = "egypt" | "world";

/** "Available in Egypt" = made locally or imported (rare formats only under Worldwide). */
export const inEgypt = (c: Pick<CatalogueCard, "availableInEgypt">) => c.availableInEgypt !== "rare";

function readUrl(): { family: string; sub: string; q: string; scope: Scope } {
  if (typeof window === "undefined") return { family: "", sub: "", q: "", scope: "egypt" };
  const p = new URLSearchParams(window.location.search);
  return { family: p.get("family") ?? "", sub: p.get("sub") ?? "", q: p.get("q") ?? "", scope: p.get("scope") === "world" ? "world" : "egypt" };
}

/**
 * Public catalogue browser: family and sub-family chips, an "Available in Egypt" / "Worldwide"
 * switch (Egypt by default), search across both names and FEFCO / ECMA codes, and a windowed
 * grid (only the rows near the viewport are in the DOM; Tab / Shift+Tab walk every model).
 * Filters live in the URL (?family=&sub=&q=&scope=) so results can be shared.
 */
export function CatalogueBrowser({ locale, cards, taxonomy }: { locale: Locale; cards: CatalogueCard[]; taxonomy: TaxonomyNode[] }) {
  const [family, setFamily] = useState("");
  const [sub, setSub] = useState("");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("egypt");
  const q = useDeferredValue(query);

  useEffect(() => {
    const u = readUrl();
    setFamily(u.family);
    setSub(u.sub);
    setQuery(u.q);
    setScope(u.scope);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const set = (k: string, v: string) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
    set("family", family);
    set("sub", sub);
    set("q", q.trim());
    set("scope", scope === "world" ? "world" : "");
    window.history.replaceState(null, "", url.toString());
  }, [family, sub, q, scope]);

  // Full haystack: the card's own text plus its family and sub-family names (both languages).
  const indexed = useMemo(() => {
    const names = new Map<string, string>();
    for (const n of taxonomy) {
      names.set(n.slug, `${n.name.ar} ${n.name.en}`);
      for (const c of n.children) names.set(c.slug, `${c.name.ar} ${c.name.en}`);
    }
    return cards.map((c) => ({ ...c, search: `${c.search} ${names.get(c.family) ?? ""} ${names.get(c.subFamily) ?? ""}`.toLowerCase() }));
  }, [cards, taxonomy]);
  const scoped = useMemo(() => (scope === "egypt" ? indexed.filter(inEgypt) : indexed), [indexed, scope]);
  // No query: lead with the launch formats (B-21); with a query: relevance.
  const searched = useMemo(() => (q.trim() ? searchRanked(scoped, q) : byWedge(scoped)), [scoped, q]);
  const familyCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of searched) {
      m.set(c.family, (m.get(c.family) ?? 0) + 1);
      if (c.subFamily !== c.family) m.set(c.subFamily, (m.get(c.subFamily) ?? 0) + 1);
    }
    return m;
  }, [searched]);
  const results = useMemo(() => searched.filter((c) => (!family || c.family === family) && (!sub || c.subFamily === sub)), [searched, family, sub]);
  const active = taxonomy.find((n) => n.slug === family);

  const reset = () => {
    setFamily("");
    setSub("");
    setQuery("");
    setScope("world");
  };

  return (
    <div className={styles.browser}>
      <div className={styles.searchRow}>
          <label className={styles.search}>
            <span className="visually-hidden">{COPY.search[locale]}</span>
            <Search size={20} aria-hidden className={styles.searchIcon} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={COPY.searchPlaceholder[locale]}
              autoComplete="off"
              enterKeyHint="search"
              className={styles.searchInput}
              data-testid="catalogue-search"
            />
            {query ? (
              <button type="button" className={styles.searchClear} onClick={() => setQuery("")} aria-label={COPY.emptyReset[locale]}>
                <X size={18} aria-hidden />
              </button>
            ) : null}
          </label>
          <div className={styles.segmented} role="group" aria-label={COPY.scopeLabel[locale]}>
            {(["egypt", "world"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={scope === s}
                className={styles.segment}
                onClick={() => setScope(s)}
                data-testid={`scope-${s}`}
              >
                {s === "egypt" ? COPY.scopeEgypt[locale] : COPY.scopeWorld[locale]}
              </button>
            ))}
          </div>
        </div>

      <div className={styles.toolbar}>
        <div className={styles.chipRow} role="group" aria-label={COPY.familiesLabel[locale]}>
          <button type="button" className={styles.chip} aria-pressed={!family} onClick={() => (setFamily(""), setSub(""))}>
            {COPY.all[locale]} <span className={styles.chipCount}>{formatNumber(searched.length)}</span>
          </button>
          {taxonomy.map((n) => {
            const count = familyCounts.get(n.slug) ?? 0;
            return (
              <button
                key={n.slug}
                type="button"
                className={styles.chip}
                aria-pressed={family === n.slug}
                disabled={count === 0 && family !== n.slug}
                onClick={() => {
                  setFamily(family === n.slug ? "" : n.slug);
                  setSub("");
                }}
                data-family={n.slug}
              >
                {n.name[locale]} <span className={styles.chipCount}>{formatNumber(count)}</span>
              </button>
            );
          })}
        </div>
        {active && active.children.length > 1 ? (
          <div className={`${styles.chipRow} ${styles.subRow}`} role="group" aria-label={COPY.subFamiliesLabel[locale]}>
            <button type="button" className={`${styles.chip} ${styles.chipSub}`} aria-pressed={!sub} onClick={() => setSub("")}>
              {COPY.all[locale]}
            </button>
            {active.children.map((c) => {
              const count = familyCounts.get(c.slug) ?? 0;
              return (
                <button key={c.slug} type="button" className={`${styles.chip} ${styles.chipSub}`} aria-pressed={sub === c.slug} disabled={count === 0 && sub !== c.slug} onClick={() => setSub(sub === c.slug ? "" : c.slug)}>
                  {c.name[locale]} <span className={styles.chipCount}>{formatNumber(count)}</span>
                </button>
              );
            })}
          </div>
        ) : null}
        <p className={styles.resultCount} role="status" data-testid="catalogue-count">
          {q.trim() ? fill(COPY.resultsFor[locale], { count: formatNumber(results.length), q: q.trim() }) : fill(COPY.results[locale], { count: formatNumber(results.length) })}
        </p>
      </div>

      {results.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>{COPY.emptyTitle[locale]}</p>
          <p className={styles.emptyBody}>{COPY.emptyBody[locale]}</p>
          <button type="button" className={styles.pillOutline} onClick={reset}>
            {COPY.emptyReset[locale]}
          </button>
        </div>
      ) : (
        <VirtualGrid locale={locale} items={results} />
      )}
    </div>
  );
}

/* ───────────────────────────── windowed grid ───────────────────────────── */

const GAP = 16;
const TEXT_H = 132;

function columnsFor(width: number) {
  if (width >= 1100) return 4;
  if (width >= 720) return 3;
  return 2;
}

function VirtualGrid({ locale, items }: { locale: Locale; items: CatalogueCard[] }) {
  const ref = useRef<HTMLUListElement | null>(null);
  const [width, setWidth] = useState(0);
  const [range, setRange] = useState({ from: 0, to: 24 });
  const pendingFocus = useRef<number | null>(null);

  const cols = columnsFor(width || 1200);
  const gap = width && width < 480 ? 12 : GAP;
  const colW = width ? (width - gap * (cols - 1)) / cols : 280;
  const rowH = colW + TEXT_H + gap;
  const rows = Math.ceil(items.length / cols);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    const vh = window.innerHeight;
    const over = vh; // one screen of overscan above and below
    const first = Math.max(0, Math.floor((-top - over) / rowH));
    const last = Math.min(rows - 1, Math.ceil((vh - top + over) / rowH));
    setRange((r) => (r.from === first * cols && r.to === (last + 1) * cols ? r : { from: first * cols, to: (last + 1) * cols }));
  }, [rowH, rows, cols]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // Items changed (filter): back to the top of the list window.
  useEffect(() => measure(), [items, measure]);

  useEffect(() => {
    const i = pendingFocus.current;
    if (i === null) return;
    const el = ref.current?.querySelector<HTMLAnchorElement>(`[data-index="${i}"] a`);
    if (el) {
      pendingFocus.current = null;
      el.focus();
    }
  });

  /** Keep Tab / Shift+Tab walking through every model, rendered or not. */
  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== "Tab") return;
    const li = (e.target as HTMLElement).closest<HTMLElement>("[data-index]");
    if (!li) return;
    const i = Number(li.dataset.index);
    const next = e.shiftKey ? i - 1 : i + 1;
    if (next < 0 || next >= items.length) return;
    if (next >= range.from && next < range.to) return; // rendered: native order works
    e.preventDefault();
    pendingFocus.current = next;
    const el = ref.current!;
    const row = Math.floor(next / cols);
    const y = el.getBoundingClientRect().top + window.scrollY + row * rowH - window.innerHeight / 3;
    window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
    measure();
  };

  const slice = items.slice(range.from, Math.min(range.to, items.length));
  return (
    <ul ref={ref} className={styles.grid} style={{ blockSize: rows * rowH - gap }} onKeyDown={onKeyDown} data-testid="catalogue-grid" aria-label={fill(COPY.results[locale], { count: formatNumber(items.length) })}>
      {slice.map((c, k) => {
        const i = range.from + k;
        const row = Math.floor(i / cols);
        const col = i % cols;
        return (
          <li
            key={c.code}
            data-index={i}
            aria-setsize={items.length}
            aria-posinset={i + 1}
            className={styles.cell}
            style={{ insetBlockStart: row * rowH, insetInlineStart: col * (colW + gap), inlineSize: colW, blockSize: colW + TEXT_H }}
          >
            <ModelCard locale={locale} card={c} eager={i < cols * 2} />
          </li>
        );
      })}
    </ul>
  );
}

export function ModelCard({ locale, card, eager = false }: { locale: Locale; card: CatalogueCard; eager?: boolean }) {
  const egypt = COPY.egypt[card.availableInEgypt][locale];
  return (
    <Link href={`/${locale}/catalog/${card.slug}`} className={styles.card} prefetch={false} data-model={card.code}>
      <span className={styles.thumb}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/models/${encodeURIComponent(card.code)}.webp`} alt="" width={480} height={480} loading={eager ? "eager" : "lazy"} decoding="async" />
      </span>
      <span className={styles.cardBody}>
        <span className={styles.cardStd} dir="ltr">
          {card.standard.code ? `${card.standard.system} ${card.standard.code}` : card.standard.label || COPY.noStandard[locale]}
        </span>
        <span className={styles.cardName}>{card.name[locale]}</span>
        <span className={styles.badges}>
          <span className={styles.badge} data-egypt={card.availableInEgypt}>
            {egypt}
          </span>
          <span className={styles.badge} data-price={card.instantPrice ? "instant" : "quote"}>
            {card.instantPrice ? COPY.instant[locale] : COPY.quote[locale]}
          </span>
        </span>
      </span>
    </Link>
  );
}
