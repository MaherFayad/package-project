"use client";

import { forwardRef, useId, type ReactNode } from "react";
import { describedBy, helpId } from "./Labelled";
import { cx } from "./utils";
import styles from "./Form.module.css";

export interface RadioButtonProps {
  label: ReactNode;
  labelHidden?: boolean;
  checked?: boolean;
  defaultChecked?: boolean;
  /** Fires when this radio becomes selected. */
  onChange?: (checked: boolean, id: string) => void;
  helpText?: ReactNode;
  disabled?: boolean;
  name: string;
  value?: string;
  id?: string;
}

/** Radio button: 16px ring, dark 2px inner ring + white dot when selected. Group radios with ChoiceList or a fieldset. */
export const RadioButton = forwardRef<HTMLInputElement, RadioButtonProps>(function RadioButton(
  { label, labelHidden, checked, defaultChecked, onChange, helpText, disabled, name, value, id: idProp },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <div className={cx(styles.Choice, disabled && styles.choiceDisabled)}>
      <label htmlFor={id} className={styles.ChoiceLabel}>
        <span className={styles.ChoiceControl}>
          <input
            ref={ref}
            id={id}
            type="radio"
            name={name}
            value={value}
            checked={checked}
            defaultChecked={defaultChecked}
            disabled={disabled}
            onChange={(e) => onChange?.(e.target.checked, id)}
            className={cx(styles.ChoiceInput, styles.RadioInput)}
            aria-describedby={describedBy(id, undefined, helpText)}
          />
          <span className={styles.RadioMark} aria-hidden="true" />
        </span>
        <span className={cx(styles.ChoiceText, labelHidden && "visually-hidden")}>{label}</span>
      </label>
      {helpText ? (
        <div id={helpId(id)} className={cx(styles.HelpText, styles.ChoiceHelp)}>
          {helpText}
        </div>
      ) : null}
    </div>
  );
});
