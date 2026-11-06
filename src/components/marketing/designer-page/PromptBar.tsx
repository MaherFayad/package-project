"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Sparkle } from "lucide-react";
import styles from "./designer-page.module.css";

/**
 * "Describe your box": a GET form to the model picker (`/[locale]/design?q=…`), so it works
 * without JavaScript too. The picker filters its models by the words (name and use keywords);
 * there is no AI behind it and the copy says so. The placeholder types example searches while
 * the field is empty, idle and on screen; never under reduced motion, never once focused
 * (the visible label stays the accessible name, WCAG 3.3.2), and never while the enclosing
 * MotionScope is paused (WCAG 2.2.2).
 */
export function PromptBar({
  action,
  label,
  submit,
  examples,
}: {
  action: string;
  label: string;
  submit: string;
  examples: string[];
}) {
  const [value, setValue] = useState("");
  const [hint, setHint] = useState(examples[0] ?? "");
  const [focused, setFocused] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (focused || value) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const el = formRef.current;
    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    if (el) io.observe(el);
    let word = 0;
    let len = 0;
    let dir = 1;
    let hold = 0;
    const id = window.setInterval(() => {
      // Stop typing while hidden or while the band's MotionScope is paused (WCAG 2.2.2).
      if (!visible || el?.closest('[data-paused="true"]')) return;
      const w = examples[word % examples.length] ?? "";
      if (hold > 0) {
        hold -= 1;
        return;
      }
      len += dir;
      if (len >= w.length) {
        dir = -1;
        hold = 14;
      } else if (len <= 0) {
        dir = 1;
        word += 1;
        hold = 3;
      }
      setHint(w.slice(0, Math.max(0, len)));
    }, 90);
    return () => {
      window.clearInterval(id);
      io.disconnect();
    };
  }, [examples, focused, value]);

  return (
    <form ref={formRef} className={styles.promptForm} action={action} method="get" role="search">
      <Sparkle className={styles.promptIcon} size={20} aria-hidden />
      <label htmlFor="dp-prompt" className={styles.srOnly}>
        {label}
      </label>
      <input
        id="dp-prompt"
        name="q"
        type="search"
        className={styles.promptInput}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={focused ? label : hint}
        autoComplete="off"
        enterKeyHint="search"
        maxLength={80}
      />
      <button type="submit" className={styles.promptSubmit} aria-label={submit}>
        <ArrowRight size={20} className={styles.flip} aria-hidden />
      </button>
    </form>
  );
}
