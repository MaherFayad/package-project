"use client";

import { Search } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { familyName, subFamilyName, taxonomy as buildTaxonomy } from "@/data/catalogue/taxonomy";
import type { CatalogueEntry } from "@/data/catalogue/types";
// Generated rows (scripts/generate-catalogue-rows.ts): no generators in this chunk (PERF-04).
import PICKER_ROWS from "@/data/catalogue/picker-rows.generated.json";
import { searchRanked } from "./rank";
import { byWedge, orderModeOf } from "@/data/catalogue/order-mode";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/i18n/client";
import { Badge, Modal, TextField } from "@/components/ui";
import type { ModelCard } from "@/lib/library/search";
import { COPY, fill } from "./copy";
import styles from "./picker.module.css";

/** Designer-ready rows only (the library); the rest are on the public catalogue. */
type PickerRow = Pick<CatalogueEntry, "code" | "slug" | "name" | "family" | "subFamily" | "standard" | "availableInEgypt" | "search">;
const NAMES = (slug: string) => {
  const f = familyName(slug);
  const s = subFamilyName(slug);
  return `${f.ar} ${f.en} ${s.ar} ${s.en}`;
};
/** Search text built here (codes, both names, standard, family names) to keep the rows file small. */
const ROWS: PickerRow[] = (PICKER_ROWS as Omit<PickerRow, "search">[]).map((r) => ({
  ...r,
  search: [r.code, r.code.replace(/[_-]/g, " "), r.name.en, r.name.ar, r.standard.label, r.standard.code ? `${r.standard.system} ${r.standard.code}` : "", NAMES(r.subFamily)].join(" ").toLowerCase(),
}));
const TREE = buildTaxonomy(ROWS.map((e) => e.subFamily));
// "Limited" is a caution, not an error: warning, not critical (R4-09).
const EGYPT_TONE = { local: "success", imported: "attention", rare: "warning" } as const;
/** B-16: models always priced by quote (rare, filling-line, quote-only stock) say so before they are picked. */
const byQuote = (code: string) => ["quote", "preview"].includes(orderModeOf(code).mode);

/**
 * In-app model picker (Polaris look): family / sub-family navigation, "Available in Egypt"
 * (default) or "Worldwide", search over both names and FEFCO / ECMA codes, and a windowed
 * grid of real 3D thumbnails inside the dialog's scroll area. Same props as the designer's
 * ModelPicker, so it drops in; `cards` is accepted for compatibility and ignored.
 */
/**
 * Search gets focus on open only with a mouse or trackpad. On touch, focusing it opens the
 * keyboard over the grid, so the dialog keeps its default focus and its title is read first
 * (WCAG 2.4.3 focus order).
 */
function finePointer(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches;
}

export function ModelPicker({ open, current, onClose, onPick }: { open: boolean; cards?: ModelCard[]; current: string; onClose: () => void; onPick: (code: string) => void }) {
  const { locale } = useI18n();
  const searchRef = useRef<HTMLInputElement | null>(null);
  return (
    <Modal open={open} onClose={onClose} title={locale === "ar" ? "اختر نموذجا" : "Choose a model"} size="large" initialFocusRef={finePointer() ? searchRef : undefined} flush>
      <CataloguePickerBody current={current} onPick={onPick} searchRef={searchRef} />
    </Modal>
  );
}

export function CataloguePickerBody({ current, onPick, searchRef }: { current?: string; onPick: (code: string) => void; searchRef?: RefObject<HTMLInputElement | null> }) {
  const { locale } = useI18n();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"egypt" | "world">("egypt");
  const [family, setFamily] = useState("");
  const [sub, setSub] = useState("");
  const q = useDeferredValue(query);

  const searched = useMemo(() => {
    const scoped = ROWS.filter((e) => scope === "world" || e.availableInEgypt !== "rare");
    return q.trim() ? searchRanked(scoped, q) : byWedge(scoped);
  }, [scope, q]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of searched) {
      m.set(e.family, (m.get(e.family) ?? 0) + 1);
      if (e.subFamily !== e.family) m.set(e.subFamily, (m.get(e.subFamily) ?? 0) + 1);
    }
    return m;
  }, [searched]);
  const results = useMemo(() => searched.filter((e) => (!family || e.family === family) && (!sub || e.subFamily === sub)), [searched, family, sub]);

  return (
    <div className={styles.picker} data-testid="catalogue-picker">
      <div className={styles.head}>
        <TextField
          ref={searchRef}
          label={COPY.search[locale]}
          labelHidden
          type="search"
          autoComplete="off"
          placeholder={COPY.searchPlaceholder[locale]}
          prefix={<Search size={16} aria-hidden />}
          value={query}
          onChange={setQuery}
          clearButton
          onClearButtonClick={() => setQuery("")}
        />
        <div className={styles.segmented} role="group" aria-label={COPY.scopeLabel[locale]}>
          {(["egypt", "world"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={scope === s} className={styles.segment} onClick={() => setScope(s)}>
              {s === "egypt" ? COPY.scopeEgypt[locale] : COPY.scopeWorld[locale]}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.columns}>
        <nav className={styles.nav} aria-label={COPY.familiesLabel[locale]}>
          <ul>
            <li>
              <button type="button" className={styles.navItem} aria-pressed={!family} onClick={() => (setFamily(""), setSub(""))}>
                <span>{COPY.all[locale]}</span>
                <span className={styles.count}>{formatNumber(searched.length)}</span>
              </button>
            </li>
            {TREE.map((n) => (
              <li key={n.slug}>
                <button type="button" className={styles.navItem} aria-pressed={family === n.slug && !sub} aria-expanded={family === n.slug} disabled={!counts.get(n.slug)} onClick={() => (setFamily(n.slug), setSub(""))}>
                  <span>{n.name[locale]}</span>
                  <span className={styles.count}>{formatNumber(counts.get(n.slug) ?? 0)}</span>
                </button>
                {family === n.slug && n.children.length > 1 ? (
                  <ul className={styles.subList}>
                    {n.children.map((c) => (
                      <li key={c.slug}>
                        <button type="button" className={`${styles.navItem} ${styles.navSub}`} aria-pressed={sub === c.slug} disabled={!counts.get(c.slug)} onClick={() => setSub(c.slug)}>
                          <span>{c.name[locale]}</span>
                          <span className={styles.count}>{formatNumber(counts.get(c.slug) ?? 0)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>
        <PickerGrid items={results} current={current} onPick={onPick} />
      </div>
      <p className="visually-hidden" role="status">
        {fill(COPY.results[locale], { count: formatNumber(results.length) })}
      </p>
    </div>
  );
}

// Name (2 lines), standard line, one badge row, padding (R4-11).
const ROW_TEXT = 108;
const GAP = 12;

function PickerGrid({ items, current, onPick }: { items: PickerRow[]; current?: string; onPick: (code: string) => void }) {
  const { locale } = useI18n();
  const scroller = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 600 });
  const [top, setTop] = useState(0);
  const pending = useRef<number | null>(null);
  const cols = Math.max(2, Math.floor((box.w + GAP) / (150 + GAP)));
  const colW = box.w ? (box.w - GAP * (cols - 1)) / cols : 150;
  const rowH = colW + ROW_TEXT + GAP;
  const rows = Math.ceil(items.length / cols);
  const first = Math.max(0, Math.floor(top / rowH) - 2);
  const last = Math.min(rows - 1, Math.ceil((top + box.h) / rowH) + 2);
  const from = first * cols;
  const to = Math.min(items.length, (last + 1) * cols);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth - 2 * 16, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    setTop(0);
  }, [items]);
  useEffect(() => {
    if (pending.current === null) return;
    const b = scroller.current?.querySelector<HTMLButtonElement>(`[data-index="${pending.current}"] button`);
    if (b) {
      pending.current = null;
      b.focus();
    }
  });
  const onScroll = useCallback(() => setTop(scroller.current?.scrollTop ?? 0), []);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const li = (e.target as HTMLElement).closest<HTMLElement>("[data-index]");
    if (!li) return;
    const next = Number(li.dataset.index) + (e.shiftKey ? -1 : 1);
    if (next < 0 || next >= items.length || (next >= from && next < to)) return;
    e.preventDefault();
    pending.current = next;
    const y = Math.floor(next / cols) * rowH - box.h / 3;
    scroller.current?.scrollTo({ top: Math.max(0, y) });
    setTop(Math.max(0, y));
  };

  return (
    <div ref={scroller} className={styles.body} onScroll={onScroll}>
      {items.length === 0 ? (
        <p className={styles.empty}>{COPY.emptyTitle[locale]}</p>
      ) : (
        <ul className={styles.grid} style={{ blockSize: rows * rowH - GAP }} onKeyDown={onKeyDown}>
          {items.slice(from, to).map((e, k) => {
            const i = from + k;
            const isCurrent = e.code === current;
            return (
              <li key={e.code} data-index={i} aria-setsize={items.length} aria-posinset={i + 1} className={styles.cell} style={{ insetBlockStart: Math.floor(i / cols) * rowH, insetInlineStart: (i % cols) * (colW + GAP), inlineSize: colW, blockSize: colW + ROW_TEXT }}>
                <button type="button" className={styles.card} aria-current={isCurrent ? "true" : undefined} data-model={e.code} onClick={() => onPick(e.code)}>
                  <span className={styles.thumb}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/models/${encodeURIComponent(e.code)}.webp`} alt="" width={240} height={240} loading="lazy" decoding="async" />
                  </span>
                  <span className={styles.name}>{e.name[locale]}</span>
                  <span className={styles.std}>
                    {/* Codes read left to right but sit at the start of the line in Arabic too (R4-07); no internal code names (R4-08). */}
                    {e.standard.code ? <bdi dir="ltr">{`${e.standard.system} ${e.standard.code}`}</bdi> : subFamilyName(e.subFamily)[locale]}
                  </span>
                  <span className={styles.meta}>
                    {isCurrent ? <Badge tone="info">{locale === "ar" ? "الحالي" : "Current"}</Badge> : null}
                    <Badge tone={EGYPT_TONE[e.availableInEgypt]}>{COPY.egypt[e.availableInEgypt][locale]}</Badge>
                    {byQuote(e.code) ? <Badge>{COPY.quote[locale]}</Badge> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
