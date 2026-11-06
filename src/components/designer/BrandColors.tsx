"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { BrandColor } from "@/types";
import { useI18n } from "@/i18n/client";
import { Banner, BlockStack, Button, InlineStack, Modal, Text, TextField } from "@/components/ui";
import { normalizeHex } from "./lib/color";
import { MAX_BRAND_COLORS } from "./lib/doc";
import styles from "./designer.module.css";

/**
 * Brand colours (integrator decision, instead of a licensed Pantone library): the signed-in
 * buyer's own named colours, shown first in every colour picker, each with optional CMYK values and
 * a spot colour reference that go to the printer as references to match.
 */
export interface BrandColorsApi {
  colors: BrandColor[];
  /** Add the colour now shown in a picker (asks for an account first when needed). */
  saveCurrent: (hex: string) => void;
  manage: () => void;
}

const Ctx = createContext<BrandColorsApi | null>(null);
export const BrandColorsProvider = Ctx.Provider;
export const useBrandColors = () => useContext(Ctx);

/** Colours of a design that match a brand colour: the printer's colour references. */
export function usedBrandColors(doc: { artwork: Record<"outside" | "inside", { background: string | null; layers: { kind: string }[] }> }, brand: BrandColor[]): BrandColor[] {
  const used = new Set<string>();
  for (const side of ["outside", "inside"] as const) {
    const s = doc.artwork[side];
    if (s.background) used.add(s.background.toLowerCase());
    for (const l of s.layers as { kind: string; color?: string; fill?: string | null; stroke?: string | null }[]) {
      for (const c of [l.color, l.fill, l.stroke]) if (typeof c === "string") used.add(c.toLowerCase());
    }
  }
  return brand.filter((b) => used.has(b.hex.toLowerCase()));
}

const pctOk = (v: string) => v === "" || (/^\d{1,3}(\.\d+)?$/.test(v) && Number(v) <= 100);
const toLatinDigits = (v: string) => v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).trim();

export function BrandColorsModal({
  open,
  colors,
  initialHex,
  onClose,
  onSave,
}: {
  open: boolean;
  colors: BrandColor[];
  initialHex?: string | null;
  onClose: () => void;
  onSave: (next: BrandColor[]) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [list, setList] = useState<BrandColor[]>(colors);
  const [name, setName] = useState("");
  const [hex, setHex] = useState(initialHex ?? "");
  const [cmyk, setCmyk] = useState(["", "", "", ""]);
  const [spot, setSpot] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setList(colors);
    setName("");
    setHex(initialHex ?? "");
    setCmyk(["", "", "", ""]);
    setSpot("");
    setError(null);
    setTried(false);
  }, [open, colors, initialHex]);

  const latin = cmyk.map(toLatinDigits);
  const cmykValid = latin.every(pctOk) && (latin.every((v) => v === "") || latin.every((v) => v !== ""));
  const hexValue = normalizeHex(hex);
  const nameValid = name.trim().length > 0;
  const full = list.length >= MAX_BRAND_COLORS;

  const persist = async (next: BrandColor[]) => {
    setBusy(true);
    setError(null);
    const ok = await onSave(next);
    setBusy(false);
    if (ok) setList(next);
    else setError(t("designer.brand.failed"));
    return ok;
  };

  const add = async () => {
    setTried(true);
    if (!nameValid || !hexValue || !cmykValid || full) return;
    const entry: BrandColor = {
      name: name.trim().slice(0, 40),
      hex: hexValue,
      ...(latin.every((v) => v !== "") ? { cmyk: latin.map(Number) as [number, number, number, number] } : {}),
      ...(spot.trim() ? { spot: spot.trim().slice(0, 60) } : {}),
    };
    const next = [...list.filter((c) => c.hex !== entry.hex), entry];
    if (await persist(next)) {
      setName("");
      setHex("");
      setCmyk(["", "", "", ""]);
      setSpot("");
      setTried(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("designer.brand.heading")} secondaryActions={[{ content: t("common.close"), onAction: onClose }]}>
      <BlockStack gap="400">
        <Text as="p" tone="subdued">
          {t("designer.brand.intro")}
        </Text>
        {error ? (
          <Banner tone="critical" inCard>
            {error}
          </Banner>
        ) : null}
        {list.length ? (
          <ul className={styles.brandList} data-testid="brand-list">
            {list.map((c) => (
              <li key={c.hex} className={styles.brandRow}>
                <span className={styles.brandChip} style={{ background: c.hex }} aria-hidden="true" />
                <span className={styles.brandText}>
                  <bdi className={styles.brandName}>{c.name}</bdi>
                  <span className={styles.brandMeta} dir="ltr">
                    {[c.hex.toUpperCase(), c.cmyk ? `CMYK ${c.cmyk.join(" / ")}` : null, c.spot ?? null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <Button
                  icon={Trash2}
                  variant="tertiary"
                  disabled={busy}
                  accessibilityLabel={t("designer.brand.remove", { name: c.name })}
                  onClick={() => void persist(list.filter((x) => x.hex !== c.hex))}
                />
              </li>
            ))}
          </ul>
        ) : (
          <Text as="p">{t("designer.brand.empty")}</Text>
        )}
        {full ? (
          <Banner tone="info" inCard>
            {t("designer.brand.full")}
          </Banner>
        ) : (
          <BlockStack gap="300">
            <InlineStack gap="300" wrap blockAlign="start">
              <div className={styles.grow}>
                <TextField label={t("designer.brand.name")} autoComplete="off" maxLength={40} value={name} onChange={setName} error={tried && !nameValid ? t("designer.brand.nameError") : undefined} />
              </div>
              <div className={styles.grow}>
                <TextField
                  label={t("designer.brand.hex")}
                  autoComplete="off"
                  dir="ltr"
                  maxLength={12}
                  value={hex}
                  onChange={setHex}
                  error={(tried || hex) && !hexValue ? t("designer.artwork.hexError") : undefined}
                />
              </div>
            </InlineStack>
            <fieldset className={styles.cmykFields}>
              <legend className={styles.fieldLegend}>{t("designer.brand.cmyk")}</legend>
              <div className={styles.cmykGrid} dir="ltr">
                {(["c", "m", "y", "k"] as const).map((k, i) => (
                  <TextField
                    key={k}
                    label={t(`designer.brand.${k}`)}
                    autoComplete="off"
                    inputMode="decimal"
                    maxLength={5}
                    value={cmyk[i]}
                    onChange={(v) => setCmyk((a) => a.map((x, j) => (j === i ? v : x)))}
                  />
                ))}
              </div>
              {!cmykValid && cmyk.some((v) => v !== "") ? (
                <Text as="p" variant="bodySm" tone="critical">
                  {t("designer.brand.cmykError")}
                </Text>
              ) : null}
            </fieldset>
            <TextField label={t("designer.brand.spot")} autoComplete="off" maxLength={60} value={spot} onChange={setSpot} helpText={t("designer.brand.spotHelp")} />
            <InlineStack>
              <Button variant="primary" onClick={() => void add()} loading={busy}>
                {t("designer.brand.add")}
              </Button>
            </InlineStack>
          </BlockStack>
        )}
      </BlockStack>
    </Modal>
  );
}
