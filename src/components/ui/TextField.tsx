"use client";

import { X } from "lucide-react";
import { forwardRef, useId, useState, type ChangeEvent, type HTMLInputTypeAttribute, type ReactNode } from "react";
import { useUi } from "./AppProvider";
import { Icon } from "./Icon";
import { describedBy, Labelled, type FieldError } from "./Labelled";
import { fill } from "./strings";
import { cx } from "./utils";
import styles from "./Form.module.css";

export interface TextFieldProps {
  label: ReactNode;
  labelHidden?: boolean;
  labelAction?: ReactNode;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, id: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  type?: HTMLInputTypeAttribute;
  /** Required by Polaris: be explicit ("off", "email", "tel", "name"…). */
  autoComplete: string;
  name?: string;
  id?: string;
  placeholder?: string;
  helpText?: ReactNode;
  error?: FieldError;
  /** Inline content before/after the value (currency, units, search icon). */
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** Controls attached to the field on the inline start/end (e.g. a Select for country code). */
  connectedLeft?: ReactNode;
  connectedRight?: ReactNode;
  multiline?: boolean | number;
  maxLength?: number;
  showCharacterCount?: boolean;
  clearButton?: boolean;
  onClearButtonClick?: () => void;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  requiredIndicator?: boolean;
  optional?: boolean;
  min?: number | string;
  max?: number | string;
  step?: number;
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
  pattern?: string;
  align?: "start" | "center" | "end";
  /** Force LTR (phone numbers, codes, emails, URLs) while the label stays in page direction. */
  dir?: "ltr" | "rtl" | "auto";
  monospaced?: boolean;
  size?: "slim" | "medium";
  autoFocus?: boolean;
  /** Visual variant: "borderless" for search inside toolbars. */
  variant?: "inherit" | "borderless";
}

/** Text input / textarea with label, help text, inline error, prefix/suffix and character count. */
export const TextField = forwardRef<HTMLInputElement | HTMLTextAreaElement, TextFieldProps>(function TextField(props, ref) {
  const {
    label,
    labelHidden,
    labelAction,
    value,
    defaultValue,
    onChange,
    onBlur,
    onFocus,
    type = "text",
    autoComplete,
    name,
    id: idProp,
    placeholder,
    helpText,
    error,
    prefix,
    suffix,
    connectedLeft,
    connectedRight,
    multiline,
    maxLength,
    showCharacterCount,
    clearButton,
    onClearButtonClick,
    disabled,
    readOnly,
    required,
    requiredIndicator,
    optional,
    min,
    max,
    step,
    inputMode,
    pattern,
    align,
    dir,
    monospaced,
    size = "medium",
    autoFocus,
    variant = "inherit",
  } = props;
  const { s } = useUi();
  const autoId = useId();
  const id = idProp ?? autoId;
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value ?? inner;
  const countId = `${id}-count`;

  const handle = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (value === undefined) setInner(e.target.value);
    onChange?.(e.target.value, id);
  };

  const common = {
    id,
    name,
    value: current,
    onChange: handle,
    onBlur,
    onFocus,
    placeholder,
    disabled,
    readOnly,
    required,
    // The visual "*" is aria-hidden, so say it programmatically too (WCAG 3.3.2 / 1.3.1).
    "aria-required": requiredIndicator && !required ? true : undefined,
    maxLength,
    autoComplete,
    autoFocus,
    dir,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy(id, error, helpText, showCharacterCount ? countId : undefined),
    className: cx(styles.Input, align && styles[`align-${align}`], monospaced && styles.mono),
  };

  const rows = typeof multiline === "number" ? multiline : 3;

  const field = (
    <div
      className={cx(
        styles.Field,
        error && styles.error,
        disabled && styles.disabled,
        readOnly && styles.readOnly,
        multiline && styles.multiline,
        size === "slim" && styles.slim,
        variant === "borderless" && styles.borderless,
      )}
    >
      {prefix ? <span className={styles.Prefix}>{prefix}</span> : null}
      {multiline ? (
        <textarea {...common} ref={ref as React.Ref<HTMLTextAreaElement>} rows={rows} />
      ) : (
        <input {...common} ref={ref as React.Ref<HTMLInputElement>} type={type} min={min} max={max} step={step} inputMode={inputMode} pattern={pattern} />
      )}
      {suffix ? <span className={styles.Suffix}>{suffix}</span> : null}
      {showCharacterCount ? (
        <span id={countId} className={styles.Count} aria-live="polite" aria-atomic="true">
          <span aria-hidden="true">{maxLength ? `${current.length}/${maxLength}` : current.length}</span>
          <span className="visually-hidden">{fill(s.characterCount, { count: current.length, max: maxLength ?? current.length })}</span>
        </span>
      ) : null}
      {clearButton && current && !disabled && !readOnly ? (
        <button
          type="button"
          className={styles.Clear}
          aria-label={s.clear}
          onClick={() => {
            if (value === undefined) setInner("");
            onClearButtonClick?.();
          }}
        >
          <Icon source={X} size="small" />
        </button>
      ) : null}
      <span className={styles.Backdrop} aria-hidden="true" />
    </div>
  );

  return (
    <Labelled id={id} label={label} labelHidden={labelHidden} labelAction={labelAction} helpText={helpText} error={error} requiredIndicator={requiredIndicator} optional={optional}>
      {connectedLeft || connectedRight ? (
        <div className={styles.Connected}>
          {connectedLeft ? <div className={styles.ConnectedItem}>{connectedLeft}</div> : null}
          <div className={styles.ConnectedPrimary}>{field}</div>
          {connectedRight ? <div className={styles.ConnectedItem}>{connectedRight}</div> : null}
        </div>
      ) : (
        field
      )}
    </Labelled>
  );
});
