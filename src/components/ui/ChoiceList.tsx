"use client";

import { useId, type ReactNode } from "react";
import { Checkbox } from "./Checkbox";
import { InlineError, type FieldError } from "./Labelled";
import { RadioButton } from "./RadioButton";
import { cx } from "./utils";
import styles from "./Form.module.css";

export interface Choice {
  label: ReactNode;
  value: string;
  helpText?: ReactNode;
  disabled?: boolean;
  /** Extra content shown under the choice while it is selected (nested fields). */
  renderChildren?: (isSelected: boolean) => ReactNode;
}

export interface ChoiceListProps {
  title: ReactNode;
  titleHidden?: boolean;
  choices: Choice[];
  selected: string[];
  onChange: (selected: string[], name: string) => void;
  allowMultiple?: boolean;
  error?: FieldError;
  disabled?: boolean;
  name?: string;
}

/** Group of radios (single) or checkboxes (multiple) in a fieldset with a legend. */
export function ChoiceList({ title, titleHidden, choices, selected, onChange, allowMultiple, error, disabled, name: nameProp }: ChoiceListProps) {
  const auto = useId();
  const name = nameProp ?? auto;
  return (
    <fieldset className={styles.Fieldset} aria-invalid={error ? true : undefined} aria-describedby={error && typeof error !== "boolean" ? `${name}-error` : undefined}>
      <legend className={cx(styles.Legend, titleHidden && "visually-hidden")}>{title}</legend>
      <ul className={styles.ChoiceListItems}>
        {choices.map((c) => {
          const isSel = selected.includes(c.value);
          const id = `${name}-${c.value}`;
          return (
            <li key={c.value}>
              {allowMultiple ? (
                <Checkbox
                  id={id}
                  name={name}
                  value={c.value}
                  label={c.label}
                  helpText={c.helpText}
                  disabled={disabled || c.disabled}
                  checked={isSel}
                  onChange={(on) => onChange(on ? [...selected, c.value] : selected.filter((v) => v !== c.value), name)}
                />
              ) : (
                <RadioButton
                  id={id}
                  name={name}
                  value={c.value}
                  label={c.label}
                  helpText={c.helpText}
                  disabled={disabled || c.disabled}
                  checked={isSel}
                  onChange={() => onChange([c.value], name)}
                />
              )}
              {c.renderChildren && isSel ? <div className={styles.ChoiceChildren}>{c.renderChildren(isSel)}</div> : null}
            </li>
          );
        })}
      </ul>
      <InlineError id={name} error={error} />
    </fieldset>
  );
}
