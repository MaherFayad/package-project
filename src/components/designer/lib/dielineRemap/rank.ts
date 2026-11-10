import type { Affine, DielineModel } from "@/lib/dieline";
import type { FaceId } from "@/types";
import type { Box, SourceFace } from "./types";

/**
 * Face agreement: does the candidate's CLOSED box take each visible face from the same panel of
 * the art that the topology reading (./faces.ts) says forms that face? The line score alone
 * cannot tell a mailer from a rigid box with a front flap (same die, the flap covers the front
 * when closed), or a tray with a skirted lid whose walls happen to land on the same lines.
 * Returns 0..1 (mean box overlap over the faces both readings have), or null without faces.
 */
export function faceAgreement(model: DielineModel, T: Affine, faces: Partial<Record<FaceId, SourceFace>> | null): number | null {
  if (!faces) return null;
  const pt = (x: number, y: number) => ({ x: T[0] * x + T[2] * y + T[4], y: T[1] * x + T[3] * y + T[5] });
  const boxOfFace = (face: FaceId): Box | null => {
    const info = model.faces[face];
    if (!info?.parts.length) return null;
    // the biggest part of the face (a lid, not the narrow flap edge beside it)
    const part = [...info.parts].sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height)[0];
    const p = model.panels.find((q) => q.id === part.panelId);
    if (!p) return null;
    const c = [pt(p.bbox.x, p.bbox.y), pt(p.bbox.x + p.bbox.width, p.bbox.y + p.bbox.height)];
    return { x0: Math.min(c[0].x, c[1].x), y0: Math.min(c[0].y, c[1].y), x1: Math.max(c[0].x, c[1].x), y1: Math.max(c[0].y, c[1].y) };
  };
  const srcBox = (f: SourceFace): Box => {
    const xs = [f.origin.x, f.origin.x + f.right.x * f.width + f.down.x * f.height];
    const ys = [f.origin.y, f.origin.y + f.right.y * f.width + f.down.y * f.height];
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  };
  const iou = (a: Box | null, b: Box | null) => {
    if (!a || !b) return 0;
    const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
    const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    const i = ix * iy;
    const u = (a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - i;
    return u > 0 ? i / u : 0;
  };
  const scores: number[] = [];
  for (const f of ["top", "bottom", "front", "back"] as FaceId[]) if (faces[f]) scores.push(iou(boxOfFace(f), srcBox(faces[f]!)));
  // Left and right: a mirrored reading swaps them, which is no disagreement about the construction.
  const L = faces.left ? srcBox(faces.left) : null;
  const R = faces.right ? srcBox(faces.right) : null;
  if (L || R) {
    const cl = boxOfFace("left");
    const cr = boxOfFace("right");
    const straight = (L ? iou(cl, L) : 0) + (R ? iou(cr, R) : 0);
    const swapped = (L ? iou(cr, L) : 0) + (R ? iou(cl, R) : 0);
    const n = (L ? 1 : 0) + (R ? 1 : 0);
    scores.push(Math.max(straight, swapped) / n);
  }
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
}

/** Weight of the face agreement in the designer's ranking. */
export const AGREEMENT_WEIGHT = 0.15;

/**
 * Designer ranking: the detector's score plus the face agreement (centred on 0.75, so a candidate
 * that reads the faces right gains and one that takes a face from the wrong panel loses).
 */
export function rankScore(score: number, agreement: number | null): number {
  return agreement == null ? score : score + AGREEMENT_WEIGHT * (agreement - 0.75);
}
