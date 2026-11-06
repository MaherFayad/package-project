"use client";

import { Check } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { InlineStack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/client";
import { luminance as luminanceOf, normalizeHex } from "./lib/color";
import { useBrandColors } from "./BrandColors";
import { parseMmInput } from "./lib/mm";
import type { DictKey } from "@/i18n/types";
import styles from "./designer.module.css";

/**
 * Number input that lets people type freely (empty, "-", "12.") and commits only valid numbers
 * within [min, max]. Shows the latest value from props when not being edited.
 */
export function NumberField({
  label,
  value,
  onCommit,
  min,
  max,
  step = 1,
  decimals = 1,
  error,
  suffix,
  helpText,
  disabled,
}: {
  label: ReactNode;
  value: number;
  onCommit: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  error?: string;
  suffix?: ReactNode;
  helpText?: ReactNode;
  disabled?: boolean;
}) {
  const fmt = (n: number) => String(Math.round(n * 10 ** decimals) / 10 ** decimals);
  const [text, setText] = useState(fmt(value));
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setText(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <TextField
      label={label}
      // R5-JR-20: text, so Arabic-Indic digits and a decimal comma work; spin-button semantics kept.
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      spinbutton={{
        now: value,
        min,
        max,
        step,
        onStep: (d) => {
          const n = Math.round((value + d) * 10 ** decimals) / 10 ** decimals;
          const c = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
          setText(fmt(c));
          onCommit(c);
        },
      }}
      suffix={suffix}
      helpText={helpText}
      disabled={disabled}
      dir="ltr"
      error={error}
      onFocus={() => {
        editing.current = true;
      }}
      onBlur={() => {
        editing.current = false;
        setText(fmt(value));
      }}
      onChange={(v) => {
        setText(v);
        const n = parseMmInput(v.trim().startsWith("-") ? v.trim().slice(1) : v) * (v.trim().startsWith("-") ? -1 : 1);
        if (v.trim() !== "" && Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max)) onCommit(n);
      }}
    />
  );
}

export const SWATCHES = ["#303030", "#ffffff", "#c8964f", "#1f3d2b", "#005bd3", "#c70a24", "#f2c14e", "#e4deff"] as const;

/** Colour swatches (single tap) + a hex code field. `allowNone` adds a "bare board" swatch. */
export function ColorField({
  label,
  value,
  onChange,
  allowNone,
  noneLabel,
  helpText,
}: {
  label: string;
  value: string | null;
  onChange: (c: string | null) => void;
  allowNone?: boolean;
  noneLabel?: string;
  helpText?: ReactNode;
}) {
  const { t } = useI18n();
  const id = useId();
  const [hex, setHex] = useState(value ?? "");
  useEffect(() => setHex(value ?? ""), [value]);
  const valid = normalizeHex(hex) !== null;
  const brand = useBrandColors();
  const inBrand = !!value && !!brand?.colors.some((c) => c.hex.toLowerCase() === value.toLowerCase());
  return (
    <fieldset className={styles.colorField} aria-describedby={helpText ? `${id}-help` : undefined}>
      <legend className={styles.fieldLegend}>{label}</legend>
      {/* Brand colours first (integrator decision): the buyer's own named colours. */}
      {brand?.colors.length ? (
        <div className={styles.swatches} role="group" aria-label={t("designer.brand.title")} data-testid="brand-swatches">
          {brand.colors.map((c) => (
            <button
              key={c.hex}
              type="button"
              className={styles.swatch}
              style={{ background: c.hex }}
              data-light={normalizeHex(c.hex) && luminanceOf(c.hex) > 0.75 ? "true" : undefined}
              aria-pressed={value?.toLowerCase() === c.hex.toLowerCase()}
              aria-label={t("designer.brand.swatch", { name: c.name, hex: c.hex })}
              title={c.name}
              onClick={() => onChange(c.hex)}
            >
              {value?.toLowerCase() === c.hex.toLowerCase() && <Check aria-hidden size={16} />}
            </button>
          ))}
        </div>
      ) : null}
      <div className={styles.swatches} role="group" aria-label={label}>
        {allowNone && (
          <button
            type="button"
            className={styles.swatch}
            data-none="true"
            aria-pressed={value === null}
            aria-label={noneLabel}
            title={noneLabel}
            onClick={() => onChange(null)}
          >
            {value === null && <Check aria-hidden size={16} />}
          </button>
        )}
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            className={styles.swatch}
            style={{ background: c }}
            data-light={c === "#ffffff" || c === "#f2c14e" || c === "#e4deff" ? "true" : undefined}
            aria-pressed={value?.toLowerCase() === c}
            aria-label={t("designer.artwork.swatch", { color: `${c}${t("designer.describe.sep")}${t(`designer.artwork.colorNames.${c}` as DictKey)}` })}
            title={t(`designer.artwork.colorNames.${c}` as DictKey)}
            onClick={() => onChange(c)}
          >
            {value?.toLowerCase() === c && <Check aria-hidden size={16} />}
          </button>
        ))}
      </div>
      <InlineStack gap="200" blockAlign="end" wrap={false}>
        <span className={styles.swatchPreview} style={{ background: normalizeHex(hex) ?? "transparent" }} aria-hidden="true" />
        <div className={styles.grow}>
          <TextField
            label={t("designer.artwork.hex")}
            autoComplete="off"
            value={hex}
            dir="ltr"
            maxLength={12}
            size="slim"
            error={hex && !valid ? t("designer.artwork.hexError") : undefined}
            onChange={(v) => {
              // R11-02: "#fff", pasted codes with spaces and Arabic-keyboard digits all apply.
              // Six digits apply as you type; the short "#rgb" form on leaving the field (it is
              // also the first half of a six-digit code being typed).
              setHex(v);
              const c = normalizeHex(v);
              if (c && v.replace(/[\s#]/g, "").length >= 6) onChange(c);
            }}
            onBlur={() => {
              const c = normalizeHex(hex);
              if (c) {
                setHex(c);
                if (c !== value) onChange(c);
              }
            }}
          />
        </div>
      </InlineStack>
      {brand ? (
        <InlineStack gap="200" wrap>
          {value && !inBrand ? (
            <Button size="slim" variant="tertiary" onClick={() => brand.saveCurrent(value)}>
              {t("designer.brand.saveCurrent")}
            </Button>
          ) : null}
          <Button size="slim" variant="tertiary" onClick={brand.manage}>
            {t("designer.brand.manage")}
          </Button>
        </InlineStack>
      ) : null}
      {helpText ? (
        <Text as="p" variant="bodySm" tone="subdued" id={`${id}-help`}>
          {helpText}
        </Text>
      ) : null}
    </fieldset>
  );
}
