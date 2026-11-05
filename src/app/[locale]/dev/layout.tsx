import type { ReactNode } from "react";

/** Developer tools area (3D engine owner). Not linked from the site; noindex. */
export default function DevLayout({ children }: { children: ReactNode }) {
  return <main id="main">{children}</main>;
}
