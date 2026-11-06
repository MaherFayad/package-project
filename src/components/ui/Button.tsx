"use client";

import NextLink from "next/link";
import { ChevronDown } from "lucide-react";
import { forwardRef, type MouseEvent, type ReactNode, type Ref } from "react";
import { useUi } from "./AppProvider";
import { Icon, renderIcon, type IconSource } from "./Icon";
import { Spinner } from "./Spinner";
import { cx } from "./utils";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "plain" | "monochromePlain";

export interface ButtonProps {
  children?: ReactNode;
  /** primary = dark filled; secondary = white bevel (default); tertiary = grey fill (page header);
   *  plain = blue text link style; monochromePlain = text in current colour. */
  variant?: ButtonVariant;
  /** critical turns primary red, and secondary/plain text red. success is for confirmations. */
  tone?: "critical" | "success";
  size?: "micro" | "slim" | "medium" | "large";
  fullWidth?: boolean;
  textAlign?: "start" | "center" | "end";
  icon?: IconSource;
  /** Show a trailing chevron (menu buttons). */
  disclosure?: boolean | "down" | "up";
  disabled?: boolean;
  loading?: boolean;
  pressed?: boolean;
  /** Render as a link (next/link for internal URLs). */
  url?: string;
  external?: boolean;
  download?: boolean | string;
  submit?: boolean;
  id?: string;
  /** Required for icon-only buttons. */
  accessibilityLabel?: string;
  ariaControls?: string;
  ariaExpanded?: boolean;
  ariaDescribedBy?: string;
  ariaHaspopup?: boolean | "menu" | "listbox" | "dialog";
  role?: string;
  onClick?: (event: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  className?: string;
  dataPrimaryLink?: boolean;
}

/**
 * Polaris-style Button. Dark primary (never green), bevelled white secondary.
 * Disabled buttons use the real `disabled` attribute; loading ones are disabled + aria-busy
 * and keep their width (label stays in the DOM, hidden behind the spinner).
 */
export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(function Button(
  {
    children,
    variant = "secondary",
    tone,
    size = "medium",
    fullWidth,
    textAlign,
    icon,
    disclosure,
    disabled,
    loading,
    pressed,
    url,
    external,
    download,
    submit,
    id,
    accessibilityLabel,
    ariaControls,
    ariaExpanded,
    ariaDescribedBy,
    ariaHaspopup,
    role,
    onClick,
    onFocus,
    onBlur,
    onKeyDown,
    className,
  },
  ref,
) {
  const { s } = useUi();
  const iconOnly = Boolean(icon) && (children === undefined || children === null || children === "");
  const cls = cx(
    styles.Button,
    styles[variant],
    tone && styles[`tone-${tone}`],
    styles[`size-${size}`],
    fullWidth && styles.fullWidth,
    textAlign && styles[`align-${textAlign}`],
    iconOnly && styles.iconOnly,
    pressed && styles.pressed,
    loading && styles.loading,
    (disabled || loading) && styles.disabled,
    className,
  );

  const content = (
    <>
      {loading ? (
        <span className={styles.Spinner}>
          <Spinner size="small" decorative />
        </span>
      ) : null}
      {icon ? <span className={styles.Icon}>{renderIcon(icon)}</span> : null}
      {!iconOnly ? <span className={styles.Text}>{children}</span> : null}
      {disclosure ? (
        <span className={cx(styles.Disclosure, disclosure === "up" && styles.up)}>
          <Icon source={ChevronDown} size="small" />
        </span>
      ) : null}
    </>
  );

  const common = {
    id,
    className: cls,
    "aria-label": accessibilityLabel,
    "aria-controls": ariaControls,
    "aria-expanded": ariaExpanded,
    "aria-describedby": ariaDescribedBy,
    "aria-haspopup": ariaHaspopup,
    "aria-pressed": pressed,
    "aria-busy": loading || undefined,
    role,
    onFocus,
    onBlur,
    onKeyDown,
  };

  if (url && !disabled && !loading) {
    if (external || download || /^(https?:|mailto:|tel:)/.test(url)) {
      return (
        <a
          {...common}
          ref={ref as Ref<HTMLAnchorElement>}
          href={url}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          download={download}
          onClick={onClick}
        >
          {content}
          {external && !accessibilityLabel ? <span className="visually-hidden"> {s.opensInNewTab}</span> : null}
        </a>
      );
    }
    return (
      <NextLink {...common} ref={ref as Ref<HTMLAnchorElement>} href={url} onClick={onClick}>
        {content}
      </NextLink>
    );
  }

  return (
    <button
      {...common}
      ref={ref as Ref<HTMLButtonElement>}
      type={submit ? "submit" : "button"}
      // A loading button stays focusable (aria-disabled, clicks ignored) so keyboard and screen
      // reader users keep their place while the action runs (WCAG 2.4.3, 4.1.2).
      disabled={disabled}
      aria-disabled={loading && !disabled ? true : undefined}
      onClick={loading ? (e) => e.preventDefault() : onClick}
    >
      {content}
    </button>
  );
});

export interface ButtonGroupProps {
  children?: ReactNode;
  /** "segmented" joins buttons into one control (split button, pager). */
  variant?: "segmented";
  gap?: "extraTight" | "tight" | "loose";
  fullWidth?: boolean;
  noWrap?: boolean;
  /** Give segmented groups a name (e.g. "Pagination"). */
  accessibilityLabel?: string;
}

export function ButtonGroup({ children, variant, gap = "tight", fullWidth, noWrap, accessibilityLabel }: ButtonGroupProps) {
  return (
    <div
      role={variant === "segmented" || accessibilityLabel ? "group" : undefined}
      aria-label={accessibilityLabel}
      className={cx(
        styles.Group,
        variant === "segmented" && styles.segmented,
        styles[`gap-${gap}`],
        fullWidth && styles.groupFullWidth,
        noWrap && styles.noWrap,
      )}
    >
      {children}
    </div>
  );
}
