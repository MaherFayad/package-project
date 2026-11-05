/** Small helpers shared by the UI kit. Server-safe (no React hooks here). */

export type ClassValue = string | false | null | undefined | 0 | 0n | boolean;

/** Join class names, skipping anything that is not a non-empty string. */
export function cx(...values: ClassValue[]): string {
  return values.filter((v): v is string => typeof v === "string" && v.length > 0).join(" ");
}

/** Elements that can take keyboard focus, in DOM order (used by Modal, Popover, Frame nav). */
export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true" && !el.closest("[inert]"),
  );
}

/** Space token names accepted by layout primitives: "400" -> var(--p-space-400). */
export type SpaceScale =
  | "0"
  | "025"
  | "050"
  | "100"
  | "150"
  | "200"
  | "300"
  | "400"
  | "500"
  | "600"
  | "800"
  | "1000"
  | "1200"
  | "1600"
  | "2000"
  | "2400"
  | "2800"
  | "3200";

export function space(s: SpaceScale | undefined): string | undefined {
  return s === undefined ? undefined : `var(--p-space-${s})`;
}

/** Responsive value: a single value or one per breakpoint (xs = phones, md >= 768px, lg >= 1040px). */
export type Responsive<T> = T | { xs?: T; sm?: T; md?: T; lg?: T; xl?: T };

const BPS = ["xs", "sm", "md", "lg", "xl"] as const;

/**
 * Turn a responsive prop into CSS custom properties (--name-xs ... --name-xl) that the
 * component's CSS module reads inside media queries. Missing breakpoints inherit upward.
 */
export function responsiveVars<T>(
  name: string,
  value: Responsive<T> | undefined,
  map: (v: T) => string | undefined,
): Record<string, string> {
  if (value === undefined) return {};
  const out: Record<string, string> = {};
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const obj = value as Partial<Record<(typeof BPS)[number], T>>;
    let last: string | undefined;
    for (const bp of BPS) {
      const v = obj[bp];
      if (v !== undefined) last = map(v);
      if (last !== undefined) out[`--${name}-${bp}`] = last;
    }
    return out;
  }
  const v = map(value as T);
  if (v !== undefined) for (const bp of BPS) out[`--${name}-${bp}`] = v;
  return out;
}
