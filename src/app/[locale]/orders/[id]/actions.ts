"use server";

import { z } from "zod";
import type { DisputeReason, Locale } from "@/types";
import { getSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { disputeSchema, idSchema, reviewSchema } from "@/lib/orders/schemas";
import { OrderError, cancelOrder, openDispute, reorder, submitReview } from "@/lib/orders/service";

/** Order page actions (owner: checkout). Buyer-only; the service re-checks ownership and state. */
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function guard(key: string) {
  const s = await getSession();
  if (!s) return null;
  const rl = rateLimit(`orders:${key}`, s.user.id, 20, 600_000);
  return rl.ok ? s.user : null;
}

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof OrderError) return { ok: false, error: e.code };
  console.error("[orders] action failed", e);
  return { ok: false, error: "generic" };
}

export async function reorderAction(orderId: string, locale: Locale): Promise<Result<{ orderId: string }>> {
  const user = await guard("reorder");
  if (!user) return { ok: false, error: "FORBIDDEN" };
  if (!idSchema.safeParse(orderId).success || !z.enum(["ar", "en"]).safeParse(locale).success) return { ok: false, error: "INVALID" };
  try {
    const r = await reorder(orderId, user, locale);
    return { ok: true, orderId: r.orderId };
  } catch (e) {
    return fail(e);
  }
}

export async function reviewAction(orderId: string, input: { rating: number; body?: string }): Promise<Result> {
  const user = await guard("review");
  if (!user) return { ok: false, error: "FORBIDDEN" };
  const p = reviewSchema.safeParse(input);
  if (!idSchema.safeParse(orderId).success || !p.success) return { ok: false, error: "INVALID" };
  try {
    await submitReview(orderId, user, p.data.rating, p.data.body ?? null);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function disputeAction(orderId: string, input: { reason: string; description: string; photos?: string[] }): Promise<Result> {
  const user = await guard("dispute");
  if (!user) return { ok: false, error: "FORBIDDEN" };
  const p = disputeSchema.safeParse(input);
  if (!idSchema.safeParse(orderId).success || !p.success) return { ok: false, error: "INVALID" };
  try {
    const photos = Array.isArray(input.photos) ? input.photos.filter((k): k is string => typeof k === "string" && k.length <= 120).slice(0, 6) : [];
    await openDispute(orderId, user, p.data.reason as DisputeReason, p.data.description, photos);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelAction(orderId: string): Promise<Result> {
  const user = await guard("cancel");
  if (!user) return { ok: false, error: "FORBIDDEN" };
  if (!idSchema.safeParse(orderId).success) return { ok: false, error: "INVALID" };
  try {
    await cancelOrder(orderId, user);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
