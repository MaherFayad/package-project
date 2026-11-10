"use client";

import { BAG_HANDLE_COLORS, type BagHandleChoice, type BagHandleColor, type BagHandleKind, type StructureFeatures } from "@/types";
import { bagDefinitionOf } from "@/lib/dieline/families/bags/definitions";
import { HANDLE_COLOR_NAMES, HANDLE_LINES, HANDLE_NAMES, handleColors, resolveHandle } from "@/lib/dieline/families/bags/handles";
import { useI18n } from "@/i18n/client";
import { Check } from "lucide-react";
import styles from "./library.module.css";
import o from "./options.module.css";

/**
 * Added by bags: handle type and colour of a store bag (DesignDoc.features.bagHandle). The handle
 * changes the die (eyelets, hand hole), the 3D model and the price, so it is a geometry change.
 */
export function BagHandleGroup({ modelCode, features, onChange }: { modelCode: string; features: StructureFeatures | undefined; onChange: (h: BagHandleChoice) => void }) {
  const { t, locale } = useI18n();
  const def = bagDefinitionOf(modelCode);
  if (!def) return null;
  const current = resolveHandle(def, features?.bagHandle);
  const colors = handleColors(current.kind);
  const pickKind = (kind: BagHandleKind) => onChange(resolveHandle(def, { kind, color: current.color }));
  const pickColor = (color: BagHandleColor) => onChange({ kind: current.kind, color });
  return (
    <>
      {def.handles.length > 1 ? (
        <fieldset className={styles.group} data-testid="bag-handle">
          <legend className={styles.groupTitle}>{t("library.panel.bagHandle")}</legend>
          <ul className={o.tiles}>
            {def.handles.map((k) => {
              const id = `bag-handle-${k}`;
              const checked = current.kind === k;
              return (
                <li key={k}>
                  <label className={o.card} htmlFor={id} data-checked={checked}>
                    <input id={id} className={o.srOnly} type="radio" name="bag-handle" value={k} checked={checked} onChange={() => pickKind(k)} />
                    <HandleSketch kind={k} color={BAG_HANDLE_COLORS[checked ? current.color : def.defaultColor]} />
                    <span className={o.cardText}>
                      <span className={o.cardName}>{HANDLE_NAMES[k][locale]}</span>
                      <span className={o.cardLine}>{HANDLE_LINES[k][locale]}</span>
                    </span>
                    <span className={o.tick} aria-hidden="true">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : null}
      {colors.length > 0 ? (
        <fieldset className={styles.group} data-testid="bag-handle-color">
          <legend className={styles.groupTitle}>{t("library.panel.bagHandleColor")}</legend>
          <div role="radiogroup" aria-label={t("library.panel.bagHandleColor")} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {colors.map((c) => {
              const checked = current.color === c;
              return (
                <label key={c} title={HANDLE_COLOR_NAMES[c][locale]} style={{ position: "relative", display: "inline-grid", placeItems: "center", inlineSize: 44, blockSize: 44, borderRadius: 22, cursor: "pointer", boxShadow: checked ? "0 0 0 2px var(--p-color-text)" : "0 0 0 1px var(--p-color-border)" }}>
                  <input className={o.srOnly} type="radio" name="bag-handle-color" value={c} checked={checked} onChange={() => pickColor(c)} aria-label={HANDLE_COLOR_NAMES[c][locale]} />
                  <span aria-hidden="true" style={{ inlineSize: 30, blockSize: 30, borderRadius: 15, background: BAG_HANDLE_COLORS[c], boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.18)" }} />
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </>
  );
}

/** Line drawing of a bag top with the handle (not mirrored in RTL: it is a picture of the product). */
function HandleSketch({ kind, color }: { kind: BagHandleKind; color: string }) {
  const rope = kind === "COTTON_ROPE" || kind === "PP_ROPE";
  const ribbon = kind === "SATIN_RIBBON" || kind === "GROSGRAIN_RIBBON";
  return (
    <svg viewBox="0 0 80 52" width="80" height="52" aria-hidden="true" style={{ direction: "ltr" }}>
      <rect x="14" y="22" width="52" height="28" rx="1.5" fill="var(--p-color-bg-surface-secondary, #f3f3f3)" stroke="currentColor" strokeOpacity="0.5" />
      {kind === "DIE_CUT" ? <rect x="30" y="27" width="20" height="7" rx="3.5" fill="none" stroke="currentColor" /> : null}
      {kind === "TWISTED_PAPER" || rope ? <path d="M30 24 C 28 4, 52 4, 50 24" fill="none" stroke={color} strokeWidth={rope ? 3 : 2.4} strokeLinecap="round" strokeDasharray={kind === "TWISTED_PAPER" ? "2 1.2" : undefined} /> : null}
      {kind === "FLAT_PAPER" ? <path d="M28 24 L 29 10 Q 40 6 51 10 L 52 24" fill="none" stroke={color} strokeWidth={4.5} strokeLinejoin="round" /> : null}
      {ribbon ? <path d="M30 24 C 28 4, 52 4, 50 24" fill="none" stroke={color} strokeWidth={5} strokeLinecap="butt" /> : null}
      {rope || kind === "SATIN_RIBBON" ? (
        <>
          <circle cx="30" cy="27" r="1.6" fill="currentColor" />
          <circle cx="50" cy="27" r="1.6" fill="currentColor" />
        </>
      ) : null}
    </svg>
  );
}
