import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { structureFromParam } from "@/components/designer/lib/catalog";

/**
 * Validates the structure segment before the editor's loading boundary, so an unknown style
 * returns a real 404 status (notFound() inside a streamed page would answer 200).
 */
export default async function StructureLayout({ children, params }: { children: ReactNode; params: Promise<{ structure: string }> }) {
  if (!structureFromParam((await params).structure)) notFound();
  return children;
}
