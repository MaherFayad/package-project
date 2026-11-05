import type { ReactNode } from "react";

/**
 * Designer area layout — FOUNDATION PLACEHOLDER. Owner: designer agent.
 * Full-screen editor chrome (no store footer). Must still render <main id="main">.
 */
export default function DesignLayout({ children }: { children: ReactNode }) {
  return <main id="main">{children}</main>;
}
