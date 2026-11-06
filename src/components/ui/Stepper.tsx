"use client";

import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { useUi } from "./AppProvider";
import { Icon } from "./Icon";
import { fill } from "./strings";
import { cx } from "./utils";
import styles from "./Stepper.module.css";

export interface StepperStep {
  id: string;
  label: ReactNode;
  /** Timestamp or detail under the label ("12 Nov, 10:30"). */
  description?: ReactNode;
}

export interface StepperProps {
  steps: StepperStep[];
  /** Index of the current step. Steps before it are complete. Use steps.length when all are done. */
  current: number;
  /** Mark the current step as failed/stopped (cancelled, refund). */
  currentTone?: "default" | "critical";
  /** Horizontal on wide screens; always vertical on phones. */
  orientation?: "horizontal" | "vertical";
  accessibilityLabel: string;
}

/**
 * Order-status stepper (Placed › Proof › Printing › Shipped › Delivered). An ordered list;
 * the current step has aria-current="step" and every step states its status in text.
 * A named group, not a <nav>: it holds no links, so it is not a navigation landmark
 * (1.3.1; R2-24).
 */
export function Stepper({ steps, current, currentTone = "default", orientation = "horizontal", accessibilityLabel }: StepperProps) {
  const { s } = useUi();
  return (
    <div role="group" aria-label={accessibilityLabel}>
      <ol className={cx(styles.Stepper, orientation === "vertical" && styles.stepperVertical)}>
        {steps.map((step, i) => {
          const state = i < current ? "complete" : i === current ? "current" : "upcoming";
          const statusText = state === "complete" ? s.stepComplete : state === "current" ? s.stepCurrent : s.stepUpcoming;
          return (
            <li
              key={step.id}
              className={cx(styles.Step, styles[`step-${state}`], state === "current" && currentTone === "critical" && styles.stepCritical)}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span className={styles.StepMarker} aria-hidden="true">
                {state === "complete" ? <Icon source={Check} size="small" /> : state === "current" && currentTone === "critical" ? <Icon source={X} size="small" /> : <span className={styles.StepDot} />}
              </span>
              <span className={styles.StepText}>
                <span className={styles.StepLabel}>{step.label}</span>
                {step.description ? <span className={styles.StepDescription}>{step.description}</span> : null}
                <span className="visually-hidden">
                  {" "}
                  ({fill(s.stepOf, { current: i + 1, total: steps.length })}, {statusText})
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
