import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { readBodyCapped } from "../../_lib/body";
import { withdrawMarketingConsent } from "@/lib/auth/marketing-consent";
import { inboundTexts, isStopReply, validWhatsAppSignature } from "@/lib/notify/whatsapp-inbound";

export const dynamic = "force-dynamic";

/**
 * WhatsApp Business (Cloud API) inbound webhook: a "STOP" / «إيقاف» reply to a marketing message
 * withdraws MARKETING consent (R4-B-08; PDPL 151/2020; WhatsApp Business messaging policy).
 *
 * - GET: Meta's subscription handshake (hub.verify_token must equal WHATSAPP_VERIFY_TOKEN).
 * - POST: the body must carry a valid `X-Hub-Signature-256` for WHATSAPP_APP_SECRET; unsigned or
 *   badly signed calls get 401 and change nothing. Without the secret the route answers 503.
 *   Every other message is ignored here (people reach the team in the same chat).
 * - Answers 200 quickly once the signature is valid, as Meta retries non-2xx deliveries.
 */
const MAX_BODY_BYTES = 256_000;

/** Constant-time compare of the subscription token (ASVS 4.0.3 V2.9 / V6.2.1). */
function sameSecret(given: string | null, expected: string): boolean {
  if (given === null) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && url.searchParams.get("hub.mode") === "subscribe" && sameSecret(url.searchParams.get("hub.verify_token"), token)) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return Response.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  // Capped while streaming (R5-SEC-06, the T-11 pattern): `req.text()` buffered any body, even a
  // chunked one with no Content-Length, before the size check and before the signature check.
  const bytes = await readBodyCapped(req, MAX_BODY_BYTES);
  if (bytes instanceof Response) return Response.json({ error: "TOO_LARGE" }, { status: 413 });
  const raw = new TextDecoder().decode(bytes);
  if (!validWhatsAppSignature(raw, req.headers.get("x-hub-signature-256"), secret)) {
    return Response.json({ error: "BAD_SIGNATURE" }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  let withdrawn = 0;
  for (const m of inboundTexts(payload)) {
    if (!isStopReply(m.text)) continue;
    try {
      const user = await db.user.findUnique({ where: { phone: m.phone }, select: { id: true, locale: true } });
      if (user && (await withdrawMarketingConsent(user.id, { locale: user.locale, userAgent: "whatsapp-stop-reply" }))) withdrawn++;
    } catch (e) {
      console.error("[whatsapp] stop reply failed", e instanceof Error ? e.message : e);
    }
  }
  return Response.json({ ok: true, withdrawn }, { headers: { "Cache-Control": "no-store" } });
}
