/**
 * Vendor profile editor schema (pure; shared by the client form and the server action).
 * Error messages are i18n codes: `vendorPortal.profile.errors.<code>`.
 */
import { z } from "zod";
import {
  EGYPT_CITIES,
  FINISH_CODES,
  MATERIAL_CODES,
  STRUCTURE_CODES,
  type MaterialCode,
  type StructureCode,
  type VendorCertification,
} from "@/types";
import { materialFitsStructure } from "@/lib/dieline/materials";

export const MACHINE_KINDS = ["OFFSET", "FLEXO", "DIGITAL", "DIE_CUTTER", "FOLDER_GLUER", "LAMINATOR", "UV_COATER"] as const;
export const CERT_CODES = ["FOOD_SAFE", "ISO_9001", "FSC", "ISO_22000"] as const;

/** Arabic must contain Arabic letters; English must contain Latin letters. */
const hasArabic = (s: string) => /[؀-ۿ]/.test(s);
const hasLatin = (s: string) => /[A-Za-z]/.test(s);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "DATE")
  .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()), "DATE");

export const uploadKeySchema = z.string().regex(/^[a-z]+\/[A-Za-z0-9_-]{1,40}\/[A-Za-z0-9_-]{8,64}\.(png|jpg|webp|pdf)$/, "KEY");

export const machineSchema = z.object({
  kind: z.enum(MACHINE_KINDS),
  model: z.string().trim().min(2, "MODEL").max(80, "TOO_LONG"),
  count: z.number().int("WHOLE").min(1, "MIN_1").max(50, "TOO_HIGH"),
});

export const certificationSchema = z.object({
  code: z.enum(CERT_CODES),
  issuer: z.string().trim().min(2, "ISSUER").max(120, "TOO_LONG"),
  validUntil: isoDate.optional().or(z.literal("").transform(() => undefined)),
  documentKey: uploadKeySchema.optional(),
});

export const profileSchema = z
  .object({
    bioAr: z
      .string()
      .trim()
      .min(40, "BIO_SHORT")
      .max(1200, "TOO_LONG")
      .refine(hasArabic, "BIO_AR_SCRIPT")
      .refine((s) => !/[ً-ْ]/.test(s), "DIACRITICS"),
    bioEn: z.string().trim().min(40, "BIO_SHORT").max(1200, "TOO_LONG").refine(hasLatin, "BIO_EN_SCRIPT"),
    machines: z.array(machineSchema).min(1, "MACHINES_EMPTY").max(30, "TOO_MANY"),
    structures: z.array(z.enum(STRUCTURE_CODES)).min(1, "STRUCTURES_EMPTY"),
    materials: z.array(z.enum(MATERIAL_CODES)).min(1, "MATERIALS_EMPTY"),
    finishes: z.array(z.enum(FINISH_CODES)),
    maxColors: z.number().int("WHOLE").min(1, "MIN_1").max(8, "TOO_HIGH"),
    digitalShortRun: z.boolean(),
    monthlyCapacityUnits: z.number().int("WHOLE").min(1000, "CAPACITY_LOW").max(50_000_000, "TOO_HIGH"),
    leadTimeDays: z.number().int("WHOLE").min(1, "MIN_1").max(60, "TOO_HIGH"),
    minOrderQty: z.number().int("WHOLE").min(1, "MIN_1").max(100_000, "TOO_HIGH"),
    serviceAreas: z.array(z.enum(EGYPT_CITIES)).min(1, "AREAS_EMPTY"),
    certifications: z.array(certificationSchema).max(8, "TOO_MANY"),
  })
  .superRefine((v, ctx) => {
    // Every structure needs at least one board the vendor can run for it.
    v.structures.forEach((s, i) => {
      if (!v.materials.some((m) => materialFitsStructure(m as MaterialCode, s as StructureCode))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["structures", i], message: "NO_MATERIAL_FOR_STRUCTURE" });
      }
    });
    const seen = new Set<string>();
    v.certifications.forEach((c, i) => {
      if (seen.has(c.code)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["certifications", i, "code"], message: "CERT_DUPLICATE" });
      seen.add(c.code);
      if (c.code === "FOOD_SAFE" && !c.documentKey) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["certifications", i, "documentKey"], message: "CERT_DOC_REQUIRED" });
      }
      if (c.validUntil && new Date(`${c.validUntil}T23:59:59Z`).getTime() < Date.now()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["certifications", i, "validUntil"], message: "CERT_EXPIRED" });
      }
    });
    const machineKinds = new Set(v.machines.map((m) => m.kind));
    if (v.digitalShortRun && !machineKinds.has("DIGITAL")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["digitalShortRun"], message: "DIGITAL_MACHINE_REQUIRED" });
    }
  });

export type ProfileInput = z.infer<typeof profileSchema>;

/** Flatten zod issues to { "machines.0.model": "MODEL" } for the form. */
export function issuesToErrors(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.join(".") || "_";
    if (!out[key]) out[key] = /^[A-Z0-9_]+$/.test(i.message) ? i.message : "INVALID";
  }
  return out;
}

/**
 * Merge edited certifications with what is stored. A certificate keeps its VERIFIED status only
 * while code, issuer, date and document are unchanged; any change (or a new one) goes back to
 * PENDING for Elba ops to check.
 */
export function mergeCertifications(prev: VendorCertification[], next: z.infer<typeof certificationSchema>[]): VendorCertification[] {
  return next.map((c) => {
    const old = prev.find((p) => p.code === c.code);
    const same =
      old &&
      old.issuer === c.issuer &&
      (old.validUntil ?? undefined) === (c.validUntil ?? undefined) &&
      (old.documentKey ?? undefined) === (c.documentKey ?? undefined);
    const status: VendorCertification["status"] = same ? (old.status ?? "VERIFIED") : "PENDING";
    const out: VendorCertification = { code: c.code, issuer: c.issuer, status };
    if (c.validUntil) out.validUntil = c.validUntil;
    if (c.documentKey) out.documentKey = c.documentKey;
    return out;
  });
}

/** Public "food safe" flag: only a verified (or legacy seed, no status) FOOD_SAFE certificate counts. */
export function isFoodSafe(certs: VendorCertification[]): boolean {
  return certs.some((c) => c.code === "FOOD_SAFE" && (c.status === undefined || c.status === "VERIFIED"));
}

/* ───────────── Portfolio ───────────── */

export const portfolioCaptionSchema = z.object({
  captionAr: z.string().trim().min(2, "CAPTION_SHORT").max(140, "TOO_LONG").refine((s) => !/[ً-ْ]/.test(s), "DIACRITICS"),
  captionEn: z.string().trim().min(2, "CAPTION_SHORT").max(140, "TOO_LONG"),
  structureCode: z.enum(STRUCTURE_CODES).nullable(),
});

export const MAX_PORTFOLIO_ITEMS = 24;

/** Move `id` by `delta` places (keyboard / button alternative to dragging). Returns a new array. */
export function moveItem<T extends { id: string }>(items: T[], id: string, delta: number): T[] {
  const from = items.findIndex((x) => x.id === id);
  if (from < 0) return items;
  const to = Math.max(0, Math.min(items.length - 1, from + delta));
  if (to === from) return items;
  const next = items.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it!);
  return next;
}

/** Move `id` to an absolute index (drag-and-drop). */
export function moveItemTo<T extends { id: string }>(items: T[], id: string, toIndex: number): T[] {
  const from = items.findIndex((x) => x.id === id);
  if (from < 0) return items;
  return moveItem(items, id, toIndex - from);
}

/** The new order must be exactly a permutation of the stored ids. */
export function isPermutation(stored: string[], next: string[]): boolean {
  if (stored.length !== next.length) return false;
  const a = [...stored].sort();
  const b = [...next].sort();
  return a.every((x, i) => x === b[i]);
}
