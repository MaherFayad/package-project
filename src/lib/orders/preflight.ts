import type { DesignDoc, PreflightIssue } from "@/types";
import { docGeometry } from "@/lib/library/doc";
import { DielineValidationError, generateDielineForMaterial } from "@/lib/dieline";
import { runPreflight, summarizePreflight } from "@/components/designer/lib/preflight";

/**
 * B-04: the SAME preflight the designer shows ("Ready to print"), run on the server at proof
 * approval against the exact snapshot that becomes the proof. Pure (no DB), so it is unit-tested.
 *
 * Red issues (low-DPI images under 150 dpi, text across a fold, ...) block the approval unless
 * the buyer explicitly acknowledged them; either way the result is stored with the proof so the
 * vendor and ops see what was approved (Consumer Protection Law 181/2018: an informed approval).
 */
export interface ProofPreflight {
  /** Number of red / amber issues. */
  errors: number;
  warnings: number;
  /** Issue codes with their face and severity (no artwork content). */
  issues: { code: PreflightIssue["code"]; severity: PreflightIssue["severity"]; face?: string }[];
  /** The buyer approved despite red issues. */
  acknowledged: boolean;
  /** False when the geometry could not be built (preflight not run; never blocks). */
  ran: boolean;
}

export function proofPreflight(doc: DesignDoc, acknowledged = false): ProofPreflight {
  let issues: PreflightIssue[];
  try {
    const model = docGeometry(doc)?.dieline ?? generateDielineForMaterial(doc.structureCode, doc.dims, doc.materialCode);
    issues = runPreflight(doc, model);
  } catch (e) {
    if (e instanceof DielineValidationError) return { errors: 0, warnings: 0, issues: [], acknowledged, ran: false };
    throw e;
  }
  const { errors, warnings } = summarizePreflight(issues);
  return {
    errors,
    warnings,
    issues: issues.slice(0, 50).map((i) => ({ code: i.code, severity: i.severity, ...(i.face ? { face: i.face } : {}) })),
    acknowledged,
    ran: true,
  };
}

/** Approval must stop: red issues the buyer did not acknowledge. */
export function preflightBlocks(p: ProofPreflight): boolean {
  return p.ran && p.errors > 0 && !p.acknowledged;
}
