/**
 * Vendor application (onboarding) schema, pure. Used by /[locale]/vendor/apply and its server action.
 * Error messages are i18n codes under `vendorPortal.apply.errors.<code>`.
 */
import { z } from "zod";
import { EGYPT_CITIES, STRUCTURE_CODES, type VendorApplicationDocument } from "@/types";
import { normalizeEgyptPhone } from "@/lib/phone";
import { uploadKeySchema } from "./profile";

/** Arabic-Indic digits -> ASCII, drop spaces/dashes. */
export function digitsOnly(s: string): string {
  return s
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[\s\-–/.]/g, "");
}

export const DOC_KINDS = ["COMMERCIAL_REGISTER", "TAX_CARD", "SAMPLE", "FOOD_SAFE_CERT", "OTHER"] as const;

export const applicationDocSchema = z.object({
  kind: z.enum(DOC_KINDS),
  key: uploadKeySchema,
  name: z.string().max(200),
  size: z.number().int().min(1),
  type: z.enum(["image/png", "image/jpeg", "image/webp", "application/pdf"]),
});

export const applicationSchema = z
  .object({
    nameAr: z.string().trim().min(2, "REQUIRED").max(80, "TOO_LONG").refine((s) => /[؀-ۿ]/.test(s), "NAME_AR_SCRIPT"),
    nameEn: z.string().trim().min(2, "REQUIRED").max(80, "TOO_LONG").refine((s) => /[A-Za-z]/.test(s), "NAME_EN_SCRIPT"),
    legalName: z.string().trim().min(2, "REQUIRED").max(160, "TOO_LONG"),
    // Commercial register number: digits only, 1 to 10 digits (office-issued serial).
    commercialRegisterNo: z
      .string()
      .transform(digitsOnly)
      .refine((s) => /^\d{1,10}$/.test(s), "CR_FORMAT"),
    // Tax registration number on the tax card: 9 digits (often written 123-456-789).
    taxCardNo: z
      .string()
      .transform(digitsOnly)
      .refine((s) => /^\d{9}$/.test(s), "TAX_FORMAT"),
    factoryAddress: z.string().trim().min(10, "ADDRESS_SHORT").max(300, "TOO_LONG"),
    factoryCity: z.enum(EGYPT_CITIES, { errorMap: () => ({ message: "REQUIRED" }) }),
    contactName: z.string().trim().min(2, "REQUIRED").max(80, "TOO_LONG"),
    contactPhone: z
      .string()
      .transform((s, ctx) => {
        const p = normalizeEgyptPhone(s);
        if (!p) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "PHONE" });
          return z.NEVER;
        }
        return p;
      }),
    structures: z.array(z.enum(STRUCTURE_CODES)).min(1, "STRUCTURES_EMPTY"),
    message: z.string().trim().max(1000, "TOO_LONG").optional().or(z.literal("")),
    documents: z
      .array(applicationDocSchema)
      .max(20, "TOO_MANY")
      .superRefine((docs, ctx) => {
        const has = (k: VendorApplicationDocument["kind"]) => docs.some((d) => d.kind === k);
        if (!has("COMMERCIAL_REGISTER")) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["COMMERCIAL_REGISTER"], message: "DOC_CR" });
        if (!has("TAX_CARD")) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["TAX_CARD"], message: "DOC_TAX" });
        if (!has("SAMPLE")) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["SAMPLE"], message: "DOC_SAMPLE" });
      }),
    acceptAgreement: z.literal(true, { errorMap: () => ({ message: "AGREEMENT_REQUIRED" }) }),
  });

export type ApplicationInput = z.input<typeof applicationSchema>;
export type ApplicationValues = z.output<typeof applicationSchema>;

/** URL slug from the English trading name: "Nile Pack & Co." -> "nile-pack-co". */
export function slugify(name: string): string {
  const s = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return s || "vendor";
}

/** First free slug given the taken ones: base, base-2, base-3 … */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const s = `${base}-${i}`;
    if (!taken.has(s)) return s;
  }
  return `${base}-${Date.now().toString(36)}`;
}
