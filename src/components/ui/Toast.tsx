"use client";

import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { uiStrings } from "./strings";
import { useOptionalI18n } from "@/i18n/client";
import { Icon } from "./Icon";
import { cx } from "./utils";
import styles from "./Toast.module.css";

export interface ToastOptions {
  /** "critical" for errors (also announced assertively). */
  tone?: "default" | "critical";
  /** ms before auto-dismiss; default 5000, 10000 when there is an action. Paused on hover/focus. */
  duration?: number;
  action?: { content: string; onAction: () => void };
}

interface ToastItem extends ToastOptions {
  id: number;
  content: ReactNode;
  /** Set on dismiss: the toast plays its exit, then is removed from the queue. */
  closing?: boolean;
}

/** Exit is --motion-fast (150ms); the fallback removes the toast if animationend never fires
 *  (background tab, display:none ancestor, test environments). */
const EXIT_FALLBACK_MS = 250;

interface ToastApi {
  show: (content: ReactNode, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 1;

/** Holds the toast queue and renders the live region (bottom centre). Mounted by AppProvider. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const parent = useContext(ToastContext);
  const [items, setItems] = useState<ToastItem[]>([]);
  // Dismiss starts the exit; remove drops the toast once the exit has played.
  const dismiss = useCallback(
    (id: number) => setItems((xs) => xs.map((x) => (x.id === id && !x.closing ? { ...x, closing: true } : x))),
    [],
  );
  const remove = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const show = useCallback((content: ReactNode, options: ToastOptions = {}) => {
    const id = nextId++;
    setItems((xs) => [...xs.slice(-2), { id, content, ...options }]);
    return id;
  }, []);
  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  // Nested providers reuse the outer queue so only one toast region exists.
  if (parent) return <>{children}</>;
  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastRegion items={items} onDismiss={dismiss} onRemove={remove} />
    </ToastContext.Provider>
  );
}

/** const toast = useToast(); toast.show("Saved"). Safe to call without a provider (no-op + warning). */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  return (
    ctx ?? {
      show: () => {
        if (process.env.NODE_ENV !== "production") console.warn("useToast: no <AppProvider> mounted");
        return 0;
      },
      dismiss: () => {},
    }
  );
}

function ToastRegion({
  items,
  onDismiss,
  onRemove,
}: {
  items: ToastItem[];
  onDismiss: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const i18n = useOptionalI18n();
  const s = uiStrings[i18n?.locale ?? "en"];
  return (
    <div className={styles.Region}>
      <div role="status" aria-live="polite" className={styles.Stack}>
        {items.filter((t) => t.tone !== "critical").map((t) => (
          <Toast key={t.id} item={t} onDismiss={onDismiss} onRemove={onRemove} closeLabel={s.dismiss} />
        ))}
      </div>
      <div role="alert" aria-live="assertive" className={styles.Stack}>
        {items.filter((t) => t.tone === "critical").map((t) => (
          <Toast key={t.id} item={t} onDismiss={onDismiss} onRemove={onRemove} closeLabel={s.dismiss} />
        ))}
      </div>
    </div>
  );
}

function Toast({
  item,
  onDismiss,
  onRemove,
  closeLabel,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
  onRemove: (id: number) => void;
  closeLabel: string;
}) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration ?? (item.action ? 10000 : 5000));
  const closing = Boolean(item.closing);
  useEffect(() => {
    // A toast with an action stays until dismissed: an auto-hiding action is a time limit the
    // user cannot extend (WCAG 2.2.1) and is hard to reach by keyboard in time.
    if (paused || item.action || closing) return;
    const started = Date.now();
    const t = window.setTimeout(() => onDismiss(item.id), remaining.current);
    return () => {
      window.clearTimeout(t);
      remaining.current -= Date.now() - started;
    };
  }, [paused, item.id, item.action, closing, onDismiss]);
  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(() => onRemove(item.id), EXIT_FALLBACK_MS);
    return () => window.clearTimeout(t);
  }, [closing, item.id, onRemove]);
  return (
    <div
      className={cx(styles.Toast, item.tone === "critical" && styles.critical)}
      data-state={closing ? "closing" : "open"}
      // Leaving: out of the tab order and the accessibility tree while the 150ms exit plays.
      inert={closing || undefined}
      onAnimationEnd={(e) => {
        if (closing && e.target === e.currentTarget) onRemove(item.id);
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className={styles.Message}>{item.content}</span>
      {item.action ? (
        <button
          type="button"
          className={styles.Action}
          onClick={() => {
            item.action?.onAction();
            onDismiss(item.id);
          }}
        >
          {item.action.content}
        </button>
      ) : null}
      <button type="button" className={styles.Close} aria-label={closeLabel} onClick={() => onDismiss(item.id)}>
        <Icon source={X} size="small" />
      </button>
    </div>
  );
}
