import type { ReactNode } from "react";

/** Developer tools (3D engine, catalogue, finishes, UI kit): a bare <main>, no site chrome. */
export default function DevToolsLayout({ children }: { children: ReactNode }) {
  return <main id="main">{children}</main>;
}
