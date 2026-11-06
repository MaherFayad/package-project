import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { devPagesEnabled } from "@/lib/env";

/** Developer tools area (3D engine owner). Not linked from the site; noindex; 404 in a deployment (R5-SEC-04). */
export default function DevLayout({ children }: { children: ReactNode }) {
  if (!devPagesEnabled()) notFound();
  return <main id="main">{children}</main>;
}
