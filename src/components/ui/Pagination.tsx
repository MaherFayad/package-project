"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useUi } from "./AppProvider";
import { Button, ButtonGroup } from "./Button";
import { Icon } from "./Icon";
import styles from "./Page.module.css";

export interface PaginationProps {
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  previousURL?: string;
  nextURL?: string;
  /** Text between the buttons, e.g. "1–50 of 230". */
  label?: ReactNode;
  accessibilityLabel?: string;
  /** "header" = small up/down pager used in detail page headers. */
  type?: "page" | "table";
}

/** ‹ › pager. Chevrons point along the reading direction (mirrored in RTL). */
export function Pagination({ hasPrevious, hasNext, onPrevious, onNext, previousURL, nextURL, label, accessibilityLabel }: PaginationProps) {
  const { s } = useUi();
  return (
    <nav aria-label={accessibilityLabel ?? `${s.previous} / ${s.next}`} className={styles.Pagination}>
      <ButtonGroup variant="segmented">
        <Button
          size="slim"
          variant="tertiary"
          icon={<Icon source={ChevronLeft} flipInRtl />}
          accessibilityLabel={s.previous}
          disabled={!hasPrevious}
          url={previousURL}
          onClick={onPrevious}
        />
        <Button
          size="slim"
          variant="tertiary"
          icon={<Icon source={ChevronRight} flipInRtl />}
          accessibilityLabel={s.next}
          disabled={!hasNext}
          url={nextURL}
          onClick={onNext}
        />
      </ButtonGroup>
      {label ? <span className={styles.PaginationLabel}>{label}</span> : null}
    </nav>
  );
}
