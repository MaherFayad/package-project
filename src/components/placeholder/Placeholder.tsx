import { Construction } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Temporary page body used by FOUNDATION placeholder routes. Owners replace their pages;
 * delete this component once nothing imports it.
 */
export function Placeholder({ title, note, children }: { title: string; note: string; children?: ReactNode }) {
  return (
    <div
      style={{
        maxWidth: "var(--p-page-max-width)",
        margin: "0 auto",
        padding: "var(--p-space-800) var(--p-page-gutter)",
      }}
    >
      <h1 style={{ fontSize: "var(--p-font-size-600)", lineHeight: "var(--p-font-line-height-800)", fontWeight: "var(--p-font-weight-bold)" }}>
        {title}
      </h1>
      <div
        style={{
          marginTop: "var(--p-space-400)",
          padding: "var(--p-space-400)",
          display: "flex",
          gap: "var(--p-space-300)",
          alignItems: "center",
          background: "var(--p-color-bg-surface)",
          borderRadius: "var(--p-border-radius-300)",
          boxShadow: "var(--p-shadow-bevel-100)",
          color: "var(--p-color-text-secondary)",
        }}
      >
        <Construction aria-hidden size={20} />
        <p>{note}</p>
      </div>
      {children}
    </div>
  );
}
