"use client";

import { Check, Minus } from "lucide-react";
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, type ReactNode } from "react";
import { describedBy, helpId, InlineError, type FieldError } from "./Labelled";
import { cx } from "./utils";
import styles from "./Form.module.css";

export interface CheckboxProps {
  label: ReactNode;
  labelHidden?: boolean;
  checked?: boolean | "indeterminate";
  defaultChecked?: boolean;
  onChange?: (checked: boolean, id: string) => void;
  helpText?: ReactNode;
  error?: FieldError;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  value?: string;
  id?: string;
  /** Use inside table rows: no label column, still a 24px+ hit area. */
  className?: string;
  ariaDescribedBy?: string;
}

/** Checkbox: 16px box, radius 4, dark fill when checked, 24px+ hit area including the label. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, labelHidden, checked, defaultChecked, onChange, helpText, error, disabled, required, name, value, id: idProp, className, ariaDescribedBy },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
  const indeterminate = checked === "indeterminate";
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <div className={cx(styles.Choice, disabled && styles.choiceDisabled, className)}>
      <label htmlFor={id} className={styles.ChoiceLabel}>
        <span className={styles.ChoiceControl}>
          <input
            ref={inputRef}
            id={id}
            type="checkbox"
            name={name}
            value={value}
            className={cx(styles.ChoiceInput, styles.CheckboxInput, error && styles.choiceError)}
            checked={checked === undefined ? undefined : checked === true}
            defaultChecked={checked === undefined ? defaultChecked : undefined}
            onChange={(e) => onChange?.(e.target.checked, id)}
            disabled={disabled}
            required={required}
            aria-checked={indeterminate ? "mixed" : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={[describedBy(id, error, helpText), ariaDescribedBy].filter(Boolean).join(" ") || undefined}
          />
          <span className={styles.CheckboxMark} aria-hidden="true">
            {indeterminate ? <Minus strokeWidth={3} /> : <Check strokeWidth={3} />}
          </span>
        </span>
        <span className={cx(styles.ChoiceText, labelHidden && "visually-hidden")}>{label}</span>
      </label>
      {helpText ? (
        <div id={helpId(id)} className={cx(styles.HelpText, styles.ChoiceHelp)}>
          {helpText}
        </div>
      ) : null}
      <div className={styles.ChoiceHelp}>
        <InlineError id={id} error={error} />
      </div>
    </div>
  );
});
