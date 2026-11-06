"use client";

import { Check } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { InlineStack, Text, TextField } from "@/components/ui";
import { useI18n } from "@/i18n/client";
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
      type="number"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      min={min}
      max={max}
      step={step}
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
        const n = Number(v.replace(",", "."));
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
  const valid = /^#[0-9a-fA-F]{6}$/.test(hex);
  return (
    <fieldset className={styles.colorField} aria-describedby={helpText ? `${id}-help` : undefined}>
      <legend className={styles.fieldLegend}>{label}</legend>
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
            {value === null && <Check aria-hidden size={14} />}
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
            {value?.toLowerCase() === c && <Check aria-hidden size={14} />}
          </button>
        ))}
      </div>
      <InlineStack gap="200" blockAlign="end" wrap={false}>
        <span className={styles.swatchPreview} style={{ background: valid ? hex : "transparent" }} aria-hidden="true" />
        <div className={styles.grow}>
          <TextField
            label={t("designer.artwork.hex")}
            autoComplete="off"
            value={hex}
            dir="ltr"
            maxLength={7}
            size="slim"
            error={hex && !valid ? t("designer.artwork.hexError") : undefined}
            onChange={(v) => {
              const next = v.startsWith("#") ? v : `#${v}`;
              setHex(v === "" ? "" : next);
              if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next.toLowerCase());
            }}
          />
        </div>
      </InlineStack>
      {helpText ? (
        <Text as="p" variant="bodySm" tone="subdued" id={`${id}-help`}>
          {helpText}
        </Text>
      ) : null}
    </fieldset>
  );
}
