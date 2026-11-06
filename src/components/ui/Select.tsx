"use client";

import { ChevronsUpDown } from "lucide-react";
import { forwardRef, useId, type ReactNode } from "react";
import { Icon } from "./Icon";
import { describedBy, Labelled, type FieldError } from "./Labelled";
import { cx } from "./utils";
import styles from "./Form.module.css";

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}
export interface SelectGroup {
  title: string;
  options: SelectOption[];
}

export interface SelectProps {
  label: ReactNode;
  labelHidden?: boolean;
  /** Inline label shown inside the control ("Sort by"), Polaris labelInline. */
  labelInline?: boolean;
  options: (SelectOption | SelectGroup | string)[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, id: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  helpText?: ReactNode;
  error?: FieldError;
  disabled?: boolean;
  required?: boolean;
  requiredIndicator?: boolean;
  name?: string;
  id?: string;
  size?: "slim" | "medium";
}

function isGroup(o: SelectOption | SelectGroup | string): o is SelectGroup {
  return typeof o === "object" && "options" in o;
}

/** Native <select> (best keyboard + screen reader support on every phone) with Polaris styling and the ⇕ icon. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, labelHidden, labelInline, options, value, defaultValue, onChange, onBlur, placeholder, helpText, error, disabled, required, requiredIndicator, name, id: idProp, size = "medium" },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const renderOption = (o: SelectOption | string) => {
    const opt = typeof o === "string" ? { label: o, value: o } : o;
    return (
      <option key={opt.value} value={opt.value} disabled={opt.disabled}>
        {opt.label}
      </option>
    );
  };
  const select = (
    <div className={cx(styles.Field, styles.SelectField, error && styles.error, disabled && styles.disabled, size === "slim" && styles.slim)}>
      {labelInline ? (
        <span className={styles.InlineLabel} aria-hidden="true">
          {label}
        </span>
      ) : null}
      <select
        ref={ref}
        id={id}
        name={name}
        value={value}
        defaultValue={value === undefined ? (defaultValue ?? (placeholder ? "" : undefined)) : undefined}
        onChange={(e) => onChange?.(e.target.value, id)}
        onBlur={onBlur}
        disabled={disabled}
        required={required}
        aria-required={requiredIndicator && !required ? true : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, helpText)}
        className={cx(styles.Input, styles.Select)}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((o, i) =>
          isGroup(o) ? (
            <optgroup key={i} label={o.title}>
              {o.options.map(renderOption)}
            </optgroup>
          ) : (
            renderOption(o)
          ),
        )}
      </select>
      <span className={styles.SelectIcon}>
        <Icon source={ChevronsUpDown} size="small" tone="subdued" />
      </span>
      <span className={styles.Backdrop} aria-hidden="true" />
    </div>
  );
  return (
    <Labelled id={id} label={label} labelHidden={labelHidden || labelInline} helpText={helpText} error={error} requiredIndicator={requiredIndicator}>
      {select}
    </Labelled>
  );
});
