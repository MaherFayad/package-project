"use client";

import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useUi } from "./AppProvider";
import { Icon } from "./Icon";
import { cx } from "./utils";
import styles from "./Form.module.css";

export type FieldError = string | ReactNode | boolean | undefined;

export function helpId(id: string) {
  return `${id}-help`;
}
export function errorId(id: string) {
  return `${id}-error`;
}
/** aria-describedby for a field: error first, then help text. */
export function describedBy(id: string, error: FieldError, helpText: ReactNode, extra?: string) {
  const ids = [error && typeof error !== "boolean" ? errorId(id) : null, helpText ? helpId(id) : null, extra].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export interface LabelledProps {
  id: string;
  label: ReactNode;
  labelHidden?: boolean;
  labelAction?: ReactNode;
  requiredIndicator?: boolean;
  optional?: boolean;
  helpText?: ReactNode;
  error?: FieldError;
  children: ReactNode;
}

/** Label above, control, then inline error and help text below (Polaris order). */
export function Labelled({ id, label, labelHidden, labelAction, requiredIndicator, optional, helpText, error, children }: LabelledProps) {
  const { s } = useUi();
  return (
    <div className={styles.Labelled}>
      <div className={cx(styles.LabelRow, labelHidden && "visually-hidden")}>
        <label htmlFor={id} className={styles.Label}>
          {label}
          {requiredIndicator ? (
            <span className={styles.Required} aria-hidden="true">
              {" *"}
            </span>
          ) : null}
          {optional ? <span className={styles.Optional}> ({s.optional})</span> : null}
        </label>
        {labelAction ? <span className={styles.LabelAction}>{labelAction}</span> : null}
      </div>
      {children}
      <InlineError id={id} error={error} />
      {helpText ? (
        <div id={helpId(id)} className={styles.HelpText}>
          {helpText}
        </div>
      ) : null}
    </div>
  );
}

export function InlineError({ id, error }: { id: string; error: FieldError }) {
  if (!error || typeof error === "boolean") return null;
  return (
    <div id={errorId(id)} className={styles.InlineError}>
      <Icon source={CircleAlert} size="small" tone="critical" />
      <span>{error}</span>
    </div>
  );
}
