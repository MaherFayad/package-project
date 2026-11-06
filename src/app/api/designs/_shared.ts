// Eager model library: doc helpers below read the registry (PERF-04).
import "@/lib/library";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { readJsonCapped } from "../_lib/body";
import { designDocSchema } from "@/components/designer/lib/doc";
import type { Actor } from "@/components/designer/server";

/** Largest accepted request body (inline images are data URLs). */
export const MAX_BODY_BYTES = 12_000_000;

export const SaveBody = z.object({
  doc: designDocSchema,
  /** Small JPEG/PNG data URL of the 3D view (optional). */
  thumbnail: z
    .string()
    .max(400_000)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
    .nullable()
    .optional(),
});

/**
 * Parse a JSON body with a size cap counted in BYTES while streaming (the old check counted
 * UTF-16 characters after buffering the whole body). Returns a ready error Response on failure.
 */
export async function readJson(req: Request): Promise<unknown | Response> {
  return readJsonCapped(req, MAX_BODY_BYTES);
}

/** 120 writes per 10 minutes per user or browser. */
export function limitWrites(actor: Actor, ip: string): Response | null {
  const key = actor.user?.id ?? actor.anonId ?? `ip:${ip}`;
  const rl = rateLimit("designs:write", key, 120, 600_000);
  if (rl.ok) return null;
  return Response.json(
    { error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec },
    { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
  );
}
