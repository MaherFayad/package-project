import { z } from "zod";
import { DISPUTE_REASONS_LIST, PAYMENT_METHODS } from "./schema-constants";
import { GOVERNORATE_NAMES } from "./governorates";
import { normalizeEgyptPhone } from "@/lib/phone";
import { cleanDisplayName } from "@/lib/auth/display-name";

/** Zod schemas shared by server actions and route handlers (client-safe). */
/** Address text goes on the courier label and the tax invoice: no control or bidi-override characters (R5-SEC-11). */
const text = (min: number, max: number) => z.string().transform(cleanDisplayName).pipe(z.string().min(min).max(max));
const opt = (max: number) => z.string().max(max * 2).transform(cleanDisplayName).pipe(z.string().max(max)).optional().transform((v) => (v ? v : undefined));

export const addressSchema = z.object({
  name: text(2, 80),
  phone: z
    .string()
    .trim()
    .max(32)
    .transform((v, ctx) => {
      const n = normalizeEgyptPhone(v);
      if (!n) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "INVALID_PHONE" });
        return z.NEVER;
      }
      return n;
    }),
  governorate: z.string().refine((g) => GOVERNORATE_NAMES.includes(g), "INVALID_GOVERNORATE"),
  city: text(2, 60),
  street: text(3, 160),
  building: opt(40),
  floor: opt(20),
  apartment: opt(20),
  landmark: opt(120),
  notes: opt(300),
});
export type AddressInput = z.input<typeof addressSchema>;

export const idSchema = z.string().regex(/^[\w-]{1,64}$/);
export const quantitySchema = z.number().int().min(1).max(1_000_000);
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export const disputeSchema = z.object({
  reason: z.enum(DISPUTE_REASONS_LIST),
  description: z.string().trim().min(10).max(2000),
});
export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(1000).optional(),
});
