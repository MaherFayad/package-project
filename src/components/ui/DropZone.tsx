"use client";

import { Upload } from "lucide-react";
import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useUi } from "./AppProvider";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { describedBy, InlineError, type FieldError } from "./Labelled";
import { cx } from "./utils";
import styles from "./Misc.module.css";

export interface DropZoneProps {
  label: ReactNode;
  labelHidden?: boolean;
  /** e.g. "image/png,image/jpeg,image/svg+xml,application/pdf" or ".pdf,.ai". */
  accept?: string;
  allowMultiple?: boolean;
  /** Bytes. */
  maxSize?: number;
  onDrop: (files: File[], accepted: File[], rejected: { file: File; reason: "type" | "size" }[]) => void;
  disabled?: boolean;
  error?: FieldError;
  helpText?: ReactNode;
  /** Replaces the default "Add files" prompt (e.g. thumbnails of uploaded files). */
  children?: ReactNode;
  /** Text on the button. */
  actionTitle?: string;
  /** Text under the button. */
  actionHint?: ReactNode;
  id?: string;
}

export function fileAccepted(file: File, accept?: string): boolean {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  return accept
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean)
    .some((rule) => {
      if (rule.startsWith(".")) return name.endsWith(rule);
      if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1));
      return type === rule;
    });
}

/**
 * File upload area. Drag-and-drop is a shortcut only: the "Add files" button opens the
 * native picker (keyboard + single pointer, WCAG 2.1.1 / 2.5.7), and the zone itself is
 * also clickable. Files are validated against `accept` and `maxSize`.
 */
export function DropZone({ label, labelHidden, accept, allowMultiple = true, maxSize, onDrop, disabled, error, helpText, children, actionTitle, actionHint, id: idProp }: DropZoneProps) {
  const { s } = useUi();
  const autoId = useId();
  const id = idProp ?? autoId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  function handle(list: FileList | null) {
    if (!list || disabled) return;
    const files = Array.from(list).slice(0, allowMultiple ? undefined : 1);
    const accepted: File[] = [];
    const rejected: { file: File; reason: "type" | "size" }[] = [];
    for (const f of files) {
      if (!fileAccepted(f, accept)) rejected.push({ file: f, reason: "type" });
      else if (maxSize && f.size > maxSize) rejected.push({ file: f, reason: "size" });
      else accepted.push(f);
    }
    onDrop(files, accepted, rejected);
  }

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    depth.current += 1;
    setDragging(true);
  };
  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  };

  return (
    <div className={styles.DropZoneField}>
      <label htmlFor={id} className={cx(styles.DropLabel, labelHidden && "visually-hidden")}>
        {label}
      </label>
      <div
        className={cx(styles.DropZone, dragging && styles.dragging, error && styles.dropError, disabled && styles.dropDisabled)}
        onDragEnter={onDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={(e) => {
          e.preventDefault();
          depth.current = 0;
          setDragging(false);
          handle(e.dataTransfer.files);
        }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button,a,input")) return;
          if (!disabled) inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          className="visually-hidden"
          tabIndex={-1}
          accept={accept}
          multiple={allowMultiple}
          disabled={disabled}
          aria-describedby={describedBy(id, error, helpText)}
          onChange={(e) => {
            handle(e.target.files);
            e.target.value = "";
          }}
        />
        {children ?? (
          <div className={styles.DropPrompt}>
            <Icon source={Upload} tone="subdued" />
            <Button size="slim" disabled={disabled} onClick={() => inputRef.current?.click()} ariaDescribedBy={describedBy(id, error, helpText)}>
              {actionTitle ?? (allowMultiple ? s.addFiles : s.addFile)}
            </Button>
            <span className={styles.DropHint}>{actionHint ?? s.dropHint}</span>
          </div>
        )}
        {dragging ? (
          <div className={styles.DropOverlay} aria-hidden="true">
            {s.dropFilesHere}
          </div>
        ) : null}
      </div>
      <InlineError id={id} error={error} />
      {helpText ? (
        <div id={`${id}-help`} className={styles.DropHelp}>
          {helpText}
        </div>
      ) : null}
    </div>
  );
}
