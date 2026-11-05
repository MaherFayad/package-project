"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import { describedBy, Labelled, type FieldError } from "./Labelled";
import { cx } from "./utils";
import styles from "./Form.module.css";

export interface RangeSliderProps {
  label: ReactNode;
  labelHidden?: boolean;
  value: number;
  onChange: (value: number, id: string) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Show the current value at the inline end of the label row. */
  output?: boolean;
  /** Format the visible value and aria-valuetext (e.g. v => `${v} mm`). */
  formatValue?: (value: number) => string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  helpText?: ReactNode;
  error?: FieldError;
  disabled?: boolean;
  id?: string;
}

/**
 * Native range input (keyboard: arrows, PageUp/Down, Home/End; single pointer: tap the track).
 * Pair with a TextField for exact entry — dragging must never be the only way (WCAG 2.5.7).
 */
export function RangeSlider({ label, labelHidden, value, onChange, min = 0, max = 100, step = 1, output, formatValue, prefix, suffix, helpText, error, disabled, id: idProp }: RangeSliderProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  const text = formatValue ? formatValue(value) : String(value);
  return (
    <Labelled
      id={id}
      label={label}
      labelHidden={labelHidden}
      helpText={helpText}
      error={error}
      labelAction={output ? <output htmlFor={id} className={styles.RangeOutput}>{text}</output> : undefined}
    >
      <div className={cx(styles.Range, disabled && styles.rangeDisabled)}>
        {prefix ? <span className={styles.RangeAffix}>{prefix}</span> : null}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value), id)}
          aria-valuetext={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, helpText)}
          className={styles.RangeInput}
          style={{ "--range-pct": `${pct}%` } as CSSProperties}
        />
        {suffix ? <span className={styles.RangeAffix}>{suffix}</span> : null}
      </div>
    </Labelled>
  );
}
