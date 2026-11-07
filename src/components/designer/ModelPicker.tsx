"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { memo, useDeferredValue, useMemo, useRef, useState, type RefObject } from "react";
import { MODEL_GROUPS, MODEL_GROUP_NAMES, type ModelGroup } from "@/lib/library/types";
import { matchesQuery, type ModelCard } from "@/lib/library/search";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/i18n/client";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { EGYPT_BADGE, byWedge, egyptOf, orderModeOf } from "@/data/catalogue/order-mode";
import styles from "./library.module.css";

/**
 * Thumbnail URL of a model: the real 3D render `public/models/<code>.webp`
 * (scripts/render-catalogue-thumbnails.ts) when the code is given, else the old line drawing.
 */
export function modelImage(slug: string, code?: string): string {
  return code ? `/models/${encodeURIComponent(code)}.webp` : `/models/${slug}.svg`;
}

/** Cards shown per group before "Show all N" (CR-30 / designer R-02). */
const PER_GROUP = 12;
const EGYPT_TONE = { local: "success", imported: "attention", rare: "warning" } as const;

/**
 * Model picker: every model of the library, grouped (Boxes, Cartons, Rigid boxes, Trays, Tubes,
 * Bottles and jars, Pouches, Cans) with a search over codes, both names and standards.
 * A plain list of buttons: keyboard and screen-reader friendly, no drag.
 */
export function ModelPicker({
  open,
  cards,
  current,
  onClose,
  onPick,
}: {
  open: boolean;
  cards: ModelCard[];
  current: string;
  onClose: () => void;
  onPick: (code: string) => void;
}) {
  const { t } = useI18n();
  const searchRef = useRef<HTMLInputElement | null>(null);
  return (
    <Modal open={open} onClose={onClose} title={t("library.picker.title")} size="large" initialFocusRef={searchRef} flush>
      <ModelBrowser cards={cards} current={current} onPick={onPick} searchRef={searchRef} />
    </Modal>
  );
}

/**
 * The grouped, searchable model list. Works on light `ModelCard`s (no generators), so catalogue
 * pages stay small. In the editor it picks (`onPick`); with `linkLocale` every card links to
 * the free designer.
 */
export function ModelBrowser({
  cards,
  current,
  onPick,
  linkLocale,
  searchRef: externalRef,
  inline = false,
  initialQuery = "",
}: {
  cards: ModelCard[];
  current?: string;
  onPick?: (code: string) => void;
  linkLocale?: string;
  searchRef?: RefObject<HTMLInputElement | null>;
  inline?: boolean;
  /** Prefilled search, e.g. from /design?q= (the designer product page's prompt bar). */
  initialQuery?: string;
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState(initialQuery);
  const [group, setGroup] = useState<ModelGroup | "ALL">("ALL");
  // B-20: "Available in Egypt" (made locally or imported) by default; "Worldwide" adds rare formats.
  const [scope, setScope] = useState<"egypt" | "world">("egypt");
  const [expanded, setExpanded] = useState<Set<ModelGroup>>(() => new Set());
  const q = useDeferredValue(query);
  // R4-23: the chips repaint at once; the (up to 370-card) list re-renders as a deferred,
  // interruptible update, so a chip press stays under the 200 ms INP budget on phones.
  const groupView = useDeferredValue(group);
  const scopeView = useDeferredValue(scope);
  const ownRef = useRef<HTMLInputElement | null>(null);
  const searchRef = externalRef ?? ownRef;

  // B-21: lead with the launch formats (core structures, then local instant models).
  const matching = useMemo(() => byWedge(cards.filter((m) => (scopeView === "world" || egyptOf(m.code) !== "rare") && matchesQuery(m, q))), [cards, q, scopeView]);
  const counts = useMemo(() => {
    const c = new Map<ModelGroup, number>();
    for (const m of matching) c.set(m.group, (c.get(m.group) ?? 0) + 1);
    return c;
  }, [matching]);
  const sections = MODEL_GROUPS.filter((g) => (groupView === "ALL" || g === groupView) && (counts.get(g) ?? 0) > 0).map((g) => ({
    group: g,
    models: matching.filter((m) => m.group === g),
  }));

  return (
    <div className={inline ? styles.browser : styles.picker} data-testid="model-picker">
      <div className={styles.pickerHead}>
        <TextField
          ref={searchRef}
          label={t("library.picker.search")}
          labelHidden
          type="search"
          autoComplete="off"
          placeholder={t("library.picker.searchPlaceholder")}
          prefix={<Search size={16} aria-hidden />}
          value={query}
          onChange={setQuery}
          clearButton
          onClearButtonClick={() => setQuery("")}
        />
        <div className={styles.scopeSwitch} role="group" aria-label={locale === "ar" ? "مكان التوفر" : "Where it is available"}>
          {(["egypt", "world"] as const).map((sc) => (
            <button key={sc} type="button" className={styles.chip} aria-pressed={scope === sc} onClick={() => setScope(sc)} data-testid={`library-scope-${sc}`}>
              {sc === "egypt" ? (locale === "ar" ? "متاح في مصر" : "Available in Egypt") : locale === "ar" ? "عالميا" : "Worldwide"}
            </button>
          ))}
        </div>
        <div className={styles.groupChips} role="group" aria-label={t("library.picker.groupsLabel")}>
          <button type="button" className={styles.chip} aria-pressed={group === "ALL"} onClick={() => setGroup("ALL")}>
            {t("library.picker.all")} <span className={styles.chipCount}>{formatNumber(matching.length)}</span>
          </button>
          {MODEL_GROUPS.map((g) => (
            <button key={g} type="button" className={styles.chip} aria-pressed={group === g} onClick={() => setGroup(g)} disabled={(counts.get(g) ?? 0) === 0}>
              {MODEL_GROUP_NAMES[g][locale]} <span className={styles.chipCount}>{formatNumber(counts.get(g) ?? 0)}</span>
            </button>
          ))}
        </div>
        <p className="visually-hidden" role="status">
          {t("library.picker.count", { count: formatNumber(sections.reduce((s, x) => s + x.models.length, 0)) })}
        </p>
      </div>
      <div className={styles.pickerBody}>
        {sections.length === 0 ? (
          <p className={styles.empty}>{t("library.picker.empty", { q: query })}</p>
        ) : (
          sections.map((s) => (
            <section key={s.group} aria-labelledby={`grp-${s.group}`} className={styles.section}>
              <h3 id={`grp-${s.group}`} className={styles.sectionTitle}>
                {MODEL_GROUP_NAMES[s.group][locale]} <span className={styles.chipCount}>{formatNumber(s.models.length)}</span>
              </h3>
              <ul className={styles.modelGrid}>
                {(groupView !== "ALL" || q.trim() || expanded.has(s.group) ? s.models : s.models.slice(0, PER_GROUP)).map((m) => (
                  <li key={m.code}>
                    <ModelButton model={m} current={m.code === current} onPick={onPick} href={linkLocale ? `/${linkLocale}/design/${m.slug}` : undefined} />
                  </li>
                ))}
              </ul>
              {groupView === "ALL" && !q.trim() && !expanded.has(s.group) && s.models.length > PER_GROUP ? (
                <div>
                  <button type="button" className={styles.chip} onClick={() => setExpanded((e) => new Set(e).add(s.group))} aria-controls={`grp-${s.group}`}>
                    {locale === "ar" ? `عرض الكل (${formatNumber(s.models.length)})` : `Show all ${formatNumber(s.models.length)}`}
                  </button>
                </div>
              ) : null}
            </section>
          ))
        )}
      </div>
    </div>
  );
}

const ModelButton = memo(function ModelButton({ model, current, onPick, href }: { model: ModelCard; current: boolean; onPick?: (code: string) => void; href?: string }) {
  const { t, locale } = useI18n();
  const body = <ModelCardBody model={model} current={current} />;
  if (href)
    return (
      <Link className={styles.modelCard} href={href} data-model={model.code} prefetch={false}>
        {body}
      </Link>
    );
  return (
    <button
      type="button"
      className={styles.modelCard}
      aria-current={current ? "true" : undefined}
      aria-label={t("library.picker.use", { name: model.name[locale] })}
      data-model={model.code}
      onClick={() => onPick?.(model.code)}
    >
      {body}
    </button>
  );
});

function ModelCardBody({ model, current }: { model: ModelCard; current: boolean }) {
  const { t, locale } = useI18n();
  return (
    <>
      <span className={styles.modelThumb}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={modelImage(model.slug, model.code)} alt="" width={160} height={120} loading="lazy" decoding="async" />
      </span>
      <span className={styles.modelName}>{model.name[locale]}</span>
      {/* The plain kind first; the FEFCO / ECMA code is the small print under it. */}
      {model.kindName ? <span className={styles.modelMeta}>{model.kindName[locale]}</span> : null}
      {model.standard && model.standard.toLowerCase() !== "none" ? (
        <span className={model.kindName ? styles.modelCode : styles.modelMeta}>
          <bdi dir="ltr">{model.standard}</bdi>
        </span>
      ) : null}
      <span className={styles.modelEgypt}>
        <Badge tone={EGYPT_TONE[egyptOf(model.code)]} size="small">
          {EGYPT_BADGE[egyptOf(model.code)][locale]}
        </Badge>
        {/* B-16: say "by quote" before the model is opened (R4-04). */}
        {["quote", "preview"].includes(orderModeOf(model.code).mode) ? <Badge size="small">{locale === "ar" ? "بعرض سعر" : "By quote"}</Badge> : null}
      </span>
      {current ? (
        <span className={styles.modelBadge}>
          <Badge tone="info">{t("library.picker.current")}</Badge>
        </span>
      ) : model.simplified ? (
        <span className={styles.modelBadge}>
          <Badge size="small">{t("library.picker.simplified")}</Badge>
        </span>
      ) : null}
    </>
  );
}
